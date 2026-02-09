import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  setupAuth(app);

  // Auth Routes
  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await storage.hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      await storage.createAuditLog(user.id, "REGISTER", req.ip);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        // Log failed login attempt (if we had the username, but we don't strictly here easily without parsing body again)
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        await storage.createAuditLog(user.id, "LOGIN_SUCCESS", req.ip);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    if (req.user) {
      storage.createAuditLog(req.user.id, "LOGOUT", req.ip);
    }
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send();
    }
  });

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).send();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    res.status(403).json({ message: "Forbidden" });
  };

  // Account Routes
  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const accounts = await storage.getAccountsByUserId(req.user!.id);
    res.json(accounts);
  });

  app.get(api.accounts.get.path, requireAuth, async (req, res) => {
    const account = await storage.getAccount(Number(req.params.id));
    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json(account);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount(req.user!.id, input.type);
      await storage.createAuditLog(req.user!.id, "CREATE_ACCOUNT", req.ip, { accountId: account.id, type: input.type });
      res.status(201).json(account);
    } catch (err) {
       res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(api.accounts.getByNumber.path, requireAuth, async (req, res) => {
    const account = await storage.getAccountByNumber(req.params.accountNumber);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    // Only return minimal info
    const user = await storage.getUser(account.userId);
    res.json({ id: account.id, fullName: user?.fullName || "Unknown" });
  });

  // Transaction Routes
  app.get(api.transactions.list.path, requireAuth, async (req, res) => {
    // If accountId provided, verify ownership
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    if (accountId) {
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized access to account" });
      }
      const transactions = await storage.getTransactionsByAccountId(accountId);
      return res.json(transactions);
    } else {
      // Get all user transactions (could be heavy, maybe just limit to recent or require account)
      // For now, let's just return empty or implement a 'getUserTransactions' in storage if needed.
      // Simpler: iterate accounts.
      const accounts = await storage.getAccountsByUserId(req.user!.id);
      let allTx: any[] = [];
      for (const acc of accounts) {
        const txs = await storage.getTransactionsByAccountId(acc.id);
        allTx = [...allTx, ...txs];
      }
      // Sort
      allTx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(allTx);
    }
  });

  app.post(api.transactions.deposit.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.deposit.input.parse(req.body);
      // Verify account ownership
      const account = await storage.getAccount(input.accountId);
      if (!account || account.userId !== req.user!.id) return res.status(403).json({ message: "Unauthorized" });

      if (req.user!.status === 'frozen') return res.status(403).json({ message: "User is frozen" });

      const tx = await storage.deposit(input.accountId, input.amount, input.narration);
      await storage.createAuditLog(req.user!.id, "DEPOSIT", req.ip, { amount: input.amount, accountId: input.accountId });
      res.status(201).json(tx);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post(api.transactions.transfer.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.transfer.input.parse(req.body);
      
      const fromAccount = await storage.getAccount(input.fromAccountId);
      if (!fromAccount || fromAccount.userId !== req.user!.id) return res.status(403).json({ message: "Unauthorized source account" });
      
      if (req.user!.status === 'frozen') return res.status(403).json({ message: "User is frozen" });

      const tx = await storage.transfer(input.fromAccountId, input.toAccountNumber, input.amount, input.narration);
      await storage.createAuditLog(req.user!.id, "TRANSFER", req.ip, { amount: input.amount, from: input.fromAccountId, to: input.toAccountNumber });
      res.status(201).json(tx);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post(api.transactions.billpay.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.billpay.input.parse(req.body);
      
      const fromAccount = await storage.getAccount(input.fromAccountId);
      if (!fromAccount || fromAccount.userId !== req.user!.id) return res.status(403).json({ message: "Unauthorized source account" });
      
      if (req.user!.status === 'frozen') return res.status(403).json({ message: "User is frozen" });

      const tx = await storage.billpay(input.fromAccountId, input.billerType, input.amount, input.narration);
      await storage.createAuditLog(req.user!.id, "BILLPAY", req.ip, { amount: input.amount, biller: input.billerType });
      res.status(201).json(tx);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Admin Routes
  app.get(api.admin.users.path, requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.patch(api.admin.updateUserStatus.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.updateUserStatus.input.parse(req.body);
      const user = await storage.updateUserStatus(Number(req.params.id), input.status);
      await storage.createAuditLog(req.user!.id, "UPDATE_USER_STATUS", req.ip, { targetUser: user.id, status: input.status });
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get(api.admin.auditLogs.path, requireAdmin, async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });
  
  // Seed Data function (exposed via internal route or just run on startup if needed, 
  // but better to have a route for "reset/seed" in dev mode, or just check on startup)
  // We'll stick to the "Lite Build" approach of seeding in a separate step or on startup.
  // I will add a simple check here to seed if empty.
  
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    console.log("Seeding database...");
    const adminHash = await storage.hashPassword("Admin123!");
    const aliceHash = await storage.hashPassword("Password123!");
    const bobHash = await storage.hashPassword("Password123!");

    await storage.createUser({ email: "admin@demo.com", password: adminHash, fullName: "Admin User", role: "admin", status: "active", phone: "0000000000" });
    const alice = await storage.createUser({ email: "alice@demo.com", password: aliceHash, fullName: "Alice Demo", role: "customer", status: "active", phone: "1111111111" });
    const bob = await storage.createUser({ email: "bob@demo.com", password: bobHash, fullName: "Bob Demo", role: "customer", status: "active", phone: "2222222222" });

    const aliceAcct = await storage.createAccount(alice.id, "savings");
    await storage.deposit(aliceAcct.id, "50000.00", "Initial Deposit");
    
    await storage.createAccount(bob.id, "current");
    console.log("Seeding complete.");
  }

  return httpServer;
}
