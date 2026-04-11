import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const SIMULATED_PRICES: Record<string, number> = {
  BTC: 97284.50, ETH: 3642.80, SOL: 178.45, ADA: 0.87,
  DOT: 8.92, LINK: 22.15, XRP: 2.34, DOGE: 0.32,
};

function getSimulatedPrice(symbol: string): number | null {
  return SIMULATED_PRICES[symbol] || null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(input.email);
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
      const hashedPassword = await storage.hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword, status: "pending" });
      await storage.createAuditLog(user.id, "REGISTER", req.ip);
      const { password: _pw, ...safeUser } = user as any;
      res.status(201).json({ ...safeUser, pending: true, message: "Your membership application has been submitted. A staff member will review and approve your account." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        await storage.createAuditLog(undefined, "LOGIN_FAILED", req.ip, {
          attemptedEmail: req.body?.username || req.body?.email || null,
          reason: info?.message || "Login failed",
        });
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        await storage.createAuditLog(user.id, "LOGIN_SUCCESS", req.ip, {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        });
        const { password: _pw, ...safeUser } = user;
        return res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, async (req, res, next) => {
    const user = req.user as any;
    if (user) {
      await storage.createAuditLog(user.id, "LOGOUT", req.ip, {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });
    }
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      const { password, ...safeUser } = req.user as any;
      res.json(safeUser);
    } else {
      res.status(401).send();
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    if (req.user?.status === "locked") {
      req.logout(() => {});
      return res.status(403).json({ message: "Your account is locked. Please contact support." });
    }
    return next();
  };

  const requireStaff = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === 'staff') return next();
    res.status(403).json({ message: "Forbidden" });
  };

  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const accounts = await storage.getAccountsByUserId(user.id);
    res.json(accounts);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const user = req.user as any;
      const application = await storage.createApplication({ userId: user.id, type: input.type as any, formData: input.formData || null });
      await storage.createAuditLog(user.id, "APPLY_ACCOUNT", req.ip, { applicationId: application.id, type: input.type });
      res.status(201).json(application);
    } catch (err: any) {
      console.error("Application create error:", err);
      res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.post(api.transactions.deposit.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.deposit.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "User is frozen" });
      const account = await storage.getAccount(input.accountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Account not found or not owned by you" });
      const tx = await storage.deposit(input.accountId, input.amount, input.narration);
      await storage.createAuditLog(user.id, "DEPOSIT_SUBMIT", req.ip, { amount: input.amount, transactionId: tx.id });
      await storage.createNotification(user.id, "deposit_submitted", `Deposit of $${input.amount} submitted and pending posting.`, { transactionId: tx.id });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post(api.transactions.transfer.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.transfer.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "User is frozen" });
      const tx = await storage.transfer(input.fromAccountId, input.toAccountNumber, input.amount, input.narration, input.rail);
      await storage.createAuditLog(user.id, "TRANSFER", req.ip, { amount: input.amount });
      await storage.createNotification(user.id, "transfer_posted", `Transfer of $${input.amount} has posted.`, { transactionId: tx.id });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get(api.transactions.list.path, requireAuth, async (req, res) => {
    try {
      const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
      const user = req.user as any;
      let txs;
      if (accountId) {
        txs = await storage.getTransactionsByAccountId(accountId);
      } else {
        const userAccounts = await storage.getAccountsByUserId(user.id);
        const allTxs = await Promise.all(
          userAccounts.map(acc => storage.getTransactionsByAccountId(acc.id))
        );
        txs = allTxs.flat().sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      }
      res.json(txs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Mobile Deposit
  app.post(api.mobileDeposit.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.mobileDeposit.create.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account is frozen" });
      const account = await storage.getAccount(input.accountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Account not found or not owned by you" });
      const deposit = await storage.createMobileDeposit(user.id, input.accountId, input.amount, input.checkFrontUrl, input.checkBackUrl);
      await storage.createAuditLog(user.id, "MOBILE_DEPOSIT_SUBMIT", req.ip, { amount: input.amount });
      res.status(201).json(deposit);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get(api.mobileDeposit.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const deposits = await storage.getMobileDepositsByUserId(user.id);
    res.json(deposits);
  });

  // Crypto
  app.get(api.crypto.holdings.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const holdings = await storage.getCryptoHoldingsByUserId(user.id);
    res.json(holdings);
  });

  app.post(api.crypto.buy.path, requireAuth, async (req, res) => {
    try {
      const input = api.crypto.buy.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account is frozen" });
      const account = await storage.getAccount(input.accountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Account not found or not owned by you" });
      const price = getSimulatedPrice(input.symbol);
      if (!price) return res.status(400).json({ message: "Unsupported cryptocurrency" });
      const serverCryptoAmount = (parseFloat(input.amountUsd) / price).toFixed(8);
      const holding = await storage.buyCrypto(user.id, input.symbol, input.name, serverCryptoAmount, input.amountUsd, input.accountId);
      await storage.createAuditLog(user.id, "CRYPTO_BUY", req.ip, { symbol: input.symbol, amountUsd: input.amountUsd, cryptoAmount: serverCryptoAmount });
      res.status(201).json(holding);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post(api.crypto.sell.path, requireAuth, async (req, res) => {
    try {
      const input = api.crypto.sell.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account is frozen" });
      const account = await storage.getAccount(input.accountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Account not found or not owned by you" });
      const holdings = await storage.getCryptoHoldingsByUserId(user.id);
      const holding = holdings.find(h => h.id === input.holdingId);
      if (!holding) return res.status(403).json({ message: "Holding not found or not owned by you" });
      const price = getSimulatedPrice(holding.symbol);
      if (!price) return res.status(400).json({ message: "Unsupported cryptocurrency" });
      const serverUsdAmount = (parseFloat(input.amountCrypto) * price).toFixed(2);
      const updated = await storage.sellCrypto(input.holdingId, input.amountCrypto, serverUsdAmount, input.accountId);
      await storage.createAuditLog(user.id, "CRYPTO_SELL", req.ip, { holdingId: input.holdingId, usdAmount: serverUsdAmount });
      res.status(200).json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post(api.crypto.send.path, requireAuth, async (req, res) => {
    try {
      const input = api.crypto.send.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account is frozen" });

      const holdings = await storage.getCryptoHoldingsByUserId(user.id);
      const holding = holdings.find(h => h.id === input.holdingId);
      if (!holding) return res.status(403).json({ message: "Holding not found or not owned by you" });

      const identifier = input.recipientIdentifier.trim();
      let recipient = await storage.getUserByUsername(identifier);
      if (!recipient) {
        const allUsers = await storage.getAllUsers();
        recipient = allUsers.find(u => u.memberNumber === identifier) || undefined;
      }
      if (!recipient) {
        const recipientHolding = await storage.getCryptoHoldingByWalletAddress(identifier);
        if (recipientHolding) {
          if (recipientHolding.symbol !== holding.symbol) {
            return res.status(400).json({ message: `That wallet address is for ${recipientHolding.symbol}, but you are sending ${holding.symbol}. Use a ${holding.symbol} wallet address.` });
          }
          recipient = await storage.getUser(recipientHolding.userId);
        }
      }
      if (!recipient) return res.status(400).json({ message: "Recipient not found. Check the email, member number, or wallet address." });
      if (recipient.id === user.id) return res.status(400).json({ message: "You cannot send crypto to yourself." });
      if (recipient.status !== 'active') return res.status(400).json({ message: "Recipient account is not active." });

      await storage.sendCrypto(user.id, input.holdingId, input.amountCrypto, recipient.id);
      await storage.createAuditLog(user.id, "CRYPTO_SEND", req.ip, { symbol: holding.symbol, amount: input.amountCrypto, recipientId: recipient.id });
      res.status(200).json({ message: `Successfully sent ${input.amountCrypto} ${holding.symbol} to ${recipient.fullName}` });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Bill Pay
  app.post(api.transactions.billpay.path, requireAuth, async (req, res) => {
    try {
      const input = api.transactions.billpay.input.parse(req.body);
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "User is frozen" });
      const account = await storage.getAccount(input.fromAccountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Account not found or not owned by you" });
      const tx = await storage.billpay(input.fromAccountId, input.billerType, input.amount, input.narration);
      await storage.createAuditLog(user.id, "BILL_PAY_SUBMIT", req.ip, { amount: input.amount, transactionId: tx.id, billerType: input.billerType });
      await storage.createNotification(user.id, "billpay_submitted", `Bill payment of $${input.amount} is pending posting.`, { transactionId: tx.id });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Admin Routes
  app.get(api.admin.users.path, requireStaff, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(({ password, ...u }) => u));
  });

  app.get(api.admin.auditLogs.path, requireStaff, async (_req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });


  app.get(api.admin.memberFinancials.path, requireStaff, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const memberUsers = allUsers.filter((u) => u.role !== "staff");
    const financials = await Promise.all(memberUsers.map(async (u) => {
      const userAccounts = await storage.getAccountsByUserId(u.id);
      const cryptoHoldings = await storage.getCryptoHoldingsByUserId(u.id);
      const totalBalance = userAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0).toFixed(2);
      return {
        userId: u.id,
        totalBalance,
        assetCount: userAccounts.length + cryptoHoldings.length,
        accountCount: userAccounts.length,
        cryptoAssetCount: cryptoHoldings.length,
      };
    }));

    res.json(financials);
  });

  app.patch(api.admin.updateUserStatus.path, requireStaff, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = api.admin.updateUserStatus.input.parse(req.body);
      const user = await storage.updateUserStatus(id, status);
      await storage.createAuditLog((req.user as any).id, `USER_STATUS_${status.toUpperCase()}`, req.ip, `User ${id} status changed to ${status}`);
      const { password: _pw, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.get("/api/admin/applications", requireStaff, async (req, res) => {
    const apps = await storage.getApplications();
    const appsWithUsers = await Promise.all(apps.map(async (app) => {
      const user = await storage.getUser(app.userId);
      if (user) {
        const { password, ...safeUser } = user as any;
        return { ...app, user: safeUser };
      }
      return { ...app, user: null };
    }));
    res.json(appsWithUsers);
  });

  app.patch("/api/admin/applications/:id", requireStaff, async (req, res) => {
    const app = await storage.updateApplicationStatus(Number(req.params.id), req.body.status, req.body.reason);
    res.json(app);
  });

  app.post("/api/admin/adjust-balance", requireStaff, async (req, res) => {
    const user = req.user as any;
    const tx = await storage.adjustBalance(req.body.accountId, req.body.amount, req.body.type, user.id, req.body.reasonCode, req.body.narration);
    res.json(tx);
  });

  app.get(api.admin.mobileDeposits.path, requireStaff, async (req, res) => {
    const deposits = await storage.getAllMobileDeposits();
    const depositsWithUsers = await Promise.all(deposits.map(async (d) => {
      const user = await storage.getUser(d.userId);
      return { ...d, user };
    }));
    res.json(depositsWithUsers);
  });

  app.patch("/api/admin/mobile-deposits/:id", requireStaff, async (req, res) => {
    try {
      const user = req.user as any;
      const deposit = await storage.reviewMobileDeposit(Number(req.params.id), req.body.status, user.id, req.body.reason);
      await storage.createAuditLog(user.id, `MOBILE_DEPOSIT_${req.body.status.toUpperCase()}`, req.ip, { depositId: deposit.id });
      if (req.body.status === "approved") {
        await storage.createNotification(deposit.userId, "mobile_deposit_approved", `Your mobile deposit of $${deposit.amount} was approved and is pending hold release.`, { depositId: deposit.id });
      }
      res.json(deposit);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });


  app.get("/api/admin/pending-transactions", requireStaff, async (_req, res) => {
    const pending = await storage.getPendingTransactionsByTypes(["deposit", "billpay"]);
    const railPending = (await storage.getAllTransactions()).filter((tx) => tx.status === "pending" && (tx.type === "transfer" || tx.type === "fee_assessment"));
    const withUsers = await Promise.all([...pending, ...railPending].map(async (tx) => {
      const accountId = tx.type === "deposit" ? tx.toAccountId : tx.fromAccountId;
      const account = accountId ? await storage.getAccount(accountId) : undefined;
      const user = account ? await storage.getUser(account.userId) : undefined;
      return { ...tx, account, user };
    }));
    res.json(withUsers);
  });

  app.patch("/api/admin/transactions/:id/review", requireStaff, async (req, res) => {
    try {
      const user = req.user as any;
      const status = req.body.status as "approved" | "rejected";
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ message: "Invalid status" });
      }
      const tx = await storage.reviewTransaction(Number(req.params.id), status, user.id, req.body.reason);
      await storage.createAuditLog(user.id, `TRANSACTION_${status.toUpperCase()}`, req.ip, { transactionId: tx.id, type: tx.type });
      if (tx.toAccountId) {
        const account = await storage.getAccount(tx.toAccountId);
        if (account) {
          await storage.createNotification(account.userId, "transaction_reviewed", `Transaction ${tx.reference} is now ${tx.status}.`, { transactionId: tx.id });
        }
      }
      res.json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post(api.transactions.settlePending.path, requireStaff, async (_req, res) => {
    const postedCount = await storage.postPendingTransactionsForSettlement();
    res.json({ postedCount });
  });

  app.get(api.holds.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const accountId = Number(req.params.accountId);
    const account = await storage.getAccount(accountId);
    if (!account || (user.role !== "staff" && account.userId !== user.id)) return res.status(403).json({ message: "Forbidden" });
    const accountHolds = await storage.getHoldsByAccountId(accountId);
    res.json(accountHolds);
  });

  app.get(api.statements.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const accountId = Number(req.params.accountId);
    const account = await storage.getAccount(accountId);
    if (!account || (user.role !== "staff" && account.userId !== user.id)) return res.status(403).json({ message: "Forbidden" });
    const result = await storage.getStatementsByAccountId(accountId);
    res.json(result);
  });

  app.post(api.statements.create.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const accountId = Number(req.params.accountId);
    const account = await storage.getAccount(accountId);
    if (!account || (user.role !== "staff" && account.userId !== user.id)) return res.status(403).json({ message: "Forbidden" });
    const input = api.statements.create.input.parse(req.body);
    const statement = await storage.createStatement(accountId, new Date(input.periodStart), new Date(input.periodEnd));
    res.status(201).json(statement);
  });

  app.get(api.notifications.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.getNotificationsByUserId(user.id);
    res.json(result);
  });

  app.patch(api.notifications.markRead.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const result = await storage.markNotificationRead(Number(req.params.id), user.id);
    res.json(result);
  });

  // User profile/widget routes
  app.patch("/api/user/widgets", requireAuth, async (req, res) => {
    const user = req.user as any;
    const updatedUser = await db.update(users)
      .set({ dashboardWidgets: req.body.widgets })
      .where(eq(users.id, user.id))
      .returning();
    res.json(updatedUser[0]);
  });

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    const user = req.user as any;
    const updatedUser = await db.update(users)
      .set({ avatarUrl: req.body.avatarUrl, fullName: req.body.fullName, phone: req.body.phone })
      .where(eq(users.id, user.id as number))
      .returning();
    res.json(updatedUser[0]);
  });

  app.patch("/api/user/password", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const input = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "New password must be at least 8 characters"),
      }).parse(req.body);

      const existingUser = await storage.getUser(user.id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const isCurrentPasswordValid = await storage.comparePasswords(input.currentPassword, existingUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const isSamePassword = await storage.comparePasswords(input.newPassword, existingUser.password);
      if (isSamePassword) {
        return res.status(400).json({ message: "New password must be different from current password" });
      }

      const hashedPassword = await storage.hashPassword(input.newPassword);
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id as number));

      await storage.createAuditLog(user.id, "PASSWORD_CHANGE", req.ip, {
        email: existingUser.email,
      });

      res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Member applications list
  app.get("/api/my-applications", requireAuth, async (req, res) => {
    const user = req.user as any;
    const apps = await storage.getApplicationsByUserId(user.id);
    res.json(apps);
  });

  // Credit Card Routes
  app.get("/api/credit-cards", requireAuth, async (req, res) => {
    const user = req.user as any;
    const cards = await storage.getCreditCardsByUserId(user.id);
    res.json(cards);
  });

  app.get("/api/credit-cards/:id/transactions", requireAuth, async (req, res) => {
    const user = req.user as any;
    const card = await storage.getCreditCard(Number(req.params.id));
    if (!card || card.userId !== user.id) return res.status(404).json({ message: "Card not found" });
    const txns = await storage.getTransactionsByCreditCardId(card.id);
    res.json(txns);
  });

  app.post("/api/credit-cards/:id/purchase", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account frozen" });
      const card = await storage.getCreditCard(Number(req.params.id));
      if (!card || card.userId !== user.id) return res.status(404).json({ message: "Card not found" });
      const { amount, merchant } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });
      const tx = await storage.creditCardPurchase(card.id, amount, merchant);
      await storage.createAuditLog(user.id, "CC_PURCHASE", req.ip, { cardId: card.id, amount, merchant });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/credit-cards/:id/payment", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.status === 'frozen') return res.status(403).json({ message: "Account frozen" });
      const card = await storage.getCreditCard(Number(req.params.id));
      if (!card || card.userId !== user.id) return res.status(404).json({ message: "Card not found" });
      const { amount, fromAccountId } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });
      const account = await storage.getAccount(fromAccountId);
      if (!account || account.userId !== user.id) return res.status(403).json({ message: "Not your account" });
      const tx = await storage.creditCardPayment(card.id, fromAccountId, amount);
      await storage.createAuditLog(user.id, "CC_PAYMENT", req.ip, { cardId: card.id, amount, fromAccountId });
      res.status(201).json(tx);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.get("/api/admin/credit-cards", requireStaff, async (req, res) => {
    const cards = await storage.getAllCreditCards();
    const cardsWithUsers = await Promise.all(cards.map(async (card) => {
      const user = await storage.getUser(card.userId);
      if (user) {
        const { password, ...safeUser } = user as any;
        return { ...card, user: safeUser };
      }
      return { ...card, user: null };
    }));
    res.json(cardsWithUsers);
  });

  // Seed data
  const staffUser = await storage.getUserByUsername("staff@demo.com");
  if (!staffUser) {
    const adminHash = await storage.hashPassword("Admin123!");
    await storage.createUser({ email: "staff@demo.com", password: adminHash, fullName: "CU Staff", role: "staff", status: "active", phone: "0000000000" });
  }
  const adminUser = await storage.getUserByUsername("admin@demo.com");
  if (!adminUser) {
    const adminHash = await storage.hashPassword("Admin123!");
    await storage.createUser({ email: "admin@demo.com", password: adminHash, fullName: "Admin User", role: "staff", status: "active", phone: "0000000000" });
  }

  return httpServer;
}
