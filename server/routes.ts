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
  setupAuth(app);

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(input.email);
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
      const hashedPassword = await storage.hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      await storage.createAuditLog(user.id, "REGISTER", req.ip);
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });
      req.login(user, async (err) => {
        if (err) return next(err);
        await storage.createAuditLog(user.id, "LOGIN_SUCCESS", req.ip);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    if (req.user) storage.createAuditLog(req.user.id, "LOGOUT", req.ip);
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) res.json(req.user);
    else res.status(401).send();
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).send();
  };

  const requireStaff = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === 'staff') return next();
    res.status(403).json({ message: "Forbidden" });
  };

  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const accounts = await storage.getAccountsByUserId(req.user!.id);
    res.json(accounts);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const app = await storage.createApplication({ userId: req.user!.id, type: input.type as any });
      await storage.createAuditLog(req.user!.id, "APPLY_ACCOUNT", req.ip, { applicationId: app.id });
      res.status(201).json(app);
    } catch (err) { res.status(500).json({ message: "Internal server error" }); }
  });

  app.post(api.transactions.deposit.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.deposit.input.parse(req.body);
      if (req.user!.status === 'frozen') return res.status(403).json({ message: "User is frozen" });
      const tx = await storage.deposit(input.accountId, input.amount, input.narration);
      await storage.createAuditLog(req.user!.id, "DEPOSIT", req.ip, { amount: input.amount });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post(api.transactions.transfer.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.transfer.input.parse(req.body);
      if (req.user!.status === 'frozen') return res.status(403).json({ message: "User is frozen" });
      const tx = await storage.transfer(input.fromAccountId, input.toAccountNumber, input.amount, input.narration);
      await storage.createAuditLog(req.user!.id, "TRANSFER", req.ip, { amount: input.amount });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Admin Routes
  app.get(api.admin.users.path, requireStaff, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/admin/applications", requireStaff, async (req, res) => {
    const apps = await storage.getApplications();
    // Attach user info to each application for the staff portal
    const appsWithUsers = await Promise.all(apps.map(async (app) => {
      const user = await storage.getUser(app.userId);
      return { ...app, user };
    }));
    res.json(appsWithUsers);
  });

  app.patch("/api/admin/applications/:id", requireStaff, async (req, res) => {
    const app = await storage.updateApplicationStatus(Number(req.params.id), req.body.status, req.body.reason);
    res.json(app);
  });

  app.post("/api/admin/adjust-balance", requireStaff, async (req, res) => {
    const tx = await storage.adjustBalance(req.body.accountId, req.body.amount, req.body.type, req.user!.id, req.body.reasonCode, req.body.narration);
    res.json(tx);
  });

  app.patch("/api/user/widgets", requireAuth, async (req, res) => {
    const user = await db.update(users)
      .set({ dashboardWidgets: req.body.widgets })
      .where(eq(users.id, req.user!.id))
      .returning();
    res.json(user[0]);
  });

  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const adminHash = await storage.hashPassword("Admin123!");
    await storage.createUser({ email: "staff@demo.com", password: adminHash, fullName: "CU Staff", role: "staff", status: "active", phone: "0000000000" });
    await storage.createUser({ email: "admin@demo.com", password: adminHash, fullName: "Admin User", role: "staff", status: "active", phone: "0000000000" });
  }

  return httpServer;
}
