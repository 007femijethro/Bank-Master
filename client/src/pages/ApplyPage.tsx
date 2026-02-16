import { useAuth } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Home, CreditCard, FileText, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

function LoanApplicationForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    loanPurpose: "",
    requestedAmount: "",
    loanTerm: "",
    employmentStatus: "",
    employer: "",
    annualIncome: "",
    monthlyExpenses: "",
    existingDebts: "",
    collateral: "",
  });

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loanPurpose">Loan Purpose</Label>
          <Select value={formData.loanPurpose} onValueChange={(v) => update("loanPurpose", v)}>
            <SelectTrigger data-testid="select-loan-purpose"><SelectValue placeholder="Select purpose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto Purchase</SelectItem>
              <SelectItem value="personal">Personal Use</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="medical">Medical Expenses</SelectItem>
              <SelectItem value="debt_consolidation">Debt Consolidation</SelectItem>
              <SelectItem value="business">Small Business</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="requestedAmount">Requested Amount ($)</Label>
          <Input data-testid="input-loan-amount" type="number" placeholder="25000" value={formData.requestedAmount} onChange={(e) => update("requestedAmount", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loanTerm">Loan Term</Label>
          <Select value={formData.loanTerm} onValueChange={(v) => update("loanTerm", v)}>
            <SelectTrigger data-testid="select-loan-term"><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 Months</SelectItem>
              <SelectItem value="24">24 Months</SelectItem>
              <SelectItem value="36">36 Months</SelectItem>
              <SelectItem value="48">48 Months</SelectItem>
              <SelectItem value="60">60 Months</SelectItem>
              <SelectItem value="72">72 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employmentStatus">Employment Status</Label>
          <Select value={formData.employmentStatus} onValueChange={(v) => update("employmentStatus", v)}>
            <SelectTrigger data-testid="select-employment"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-Time Employed</SelectItem>
              <SelectItem value="part_time">Part-Time Employed</SelectItem>
              <SelectItem value="self_employed">Self-Employed</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="unemployed">Unemployed</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employer">Employer Name</Label>
          <Input data-testid="input-employer" placeholder="Company Inc." value={formData.employer} onChange={(e) => update("employer", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualIncome">Annual Income ($)</Label>
          <Input data-testid="input-annual-income" type="number" placeholder="65000" value={formData.annualIncome} onChange={(e) => update("annualIncome", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyExpenses">Monthly Expenses ($)</Label>
          <Input data-testid="input-monthly-expenses" type="number" placeholder="3000" value={formData.monthlyExpenses} onChange={(e) => update("monthlyExpenses", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="existingDebts">Existing Debts ($)</Label>
          <Input data-testid="input-existing-debts" type="number" placeholder="10000" value={formData.existingDebts} onChange={(e) => update("existingDebts", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="collateral">Collateral Description (if any)</Label>
        <Input data-testid="input-collateral" placeholder="e.g., 2022 Toyota Camry" value={formData.collateral} onChange={(e) => update("collateral", e.target.value)} />
      </div>
      <Button data-testid="button-submit-loan" className="w-full" disabled={isPending || !formData.requestedAmount}
        onClick={() => onSubmit({ type: "loan", formData })}>
        <Send className="w-4 h-4 mr-2" /> Submit Loan Application
      </Button>
    </div>
  );
}

function HomeEquityForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    propertyAddress: "",
    estimatedValue: "",
    currentMortgageBalance: "",
    requestedAmount: "",
    loanTerm: "",
    propertyType: "",
    yearPurchased: "",
    annualIncome: "",
    employmentStatus: "",
    purpose: "",
  });

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="propertyAddress">Property Address</Label>
          <Input data-testid="input-property-address" placeholder="123 Main St, City, State ZIP" value={formData.propertyAddress} onChange={(e) => update("propertyAddress", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Property Type</Label>
          <Select value={formData.propertyType} onValueChange={(v) => update("propertyType", v)}>
            <SelectTrigger data-testid="select-property-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single_family">Single Family</SelectItem>
              <SelectItem value="condo">Condominium</SelectItem>
              <SelectItem value="townhouse">Townhouse</SelectItem>
              <SelectItem value="multi_family">Multi-Family</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year Purchased</Label>
          <Input data-testid="input-year-purchased" type="number" placeholder="2018" value={formData.yearPurchased} onChange={(e) => update("yearPurchased", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estimated Property Value ($)</Label>
          <Input data-testid="input-property-value" type="number" placeholder="350000" value={formData.estimatedValue} onChange={(e) => update("estimatedValue", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Current Mortgage Balance ($)</Label>
          <Input data-testid="input-mortgage-balance" type="number" placeholder="200000" value={formData.currentMortgageBalance} onChange={(e) => update("currentMortgageBalance", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Requested Equity Amount ($)</Label>
          <Input data-testid="input-equity-amount" type="number" placeholder="50000" value={formData.requestedAmount} onChange={(e) => update("requestedAmount", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Loan Term</Label>
          <Select value={formData.loanTerm} onValueChange={(v) => update("loanTerm", v)}>
            <SelectTrigger data-testid="select-equity-term"><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">5 Years</SelectItem>
              <SelectItem value="120">10 Years</SelectItem>
              <SelectItem value="180">15 Years</SelectItem>
              <SelectItem value="240">20 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Employment Status</Label>
          <Select value={formData.employmentStatus} onValueChange={(v) => update("employmentStatus", v)}>
            <SelectTrigger data-testid="select-equity-employment"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-Time Employed</SelectItem>
              <SelectItem value="part_time">Part-Time Employed</SelectItem>
              <SelectItem value="self_employed">Self-Employed</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Annual Income ($)</Label>
          <Input data-testid="input-equity-income" type="number" placeholder="85000" value={formData.annualIncome} onChange={(e) => update("annualIncome", e.target.value)} />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label>Purpose of Home Equity</Label>
          <Select value={formData.purpose} onValueChange={(v) => update("purpose", v)}>
            <SelectTrigger data-testid="select-equity-purpose"><SelectValue placeholder="Select purpose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="renovation">Home Renovation</SelectItem>
              <SelectItem value="debt_consolidation">Debt Consolidation</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="medical">Medical Expenses</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button data-testid="button-submit-equity" className="w-full" disabled={isPending || !formData.requestedAmount}
        onClick={() => onSubmit({ type: "home_equity", formData })}>
        <Send className="w-4 h-4 mr-2" /> Submit Home Equity Application
      </Button>
    </div>
  );
}

function CreditCardForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [formData, setFormData] = useState({
    cardType: "",
    requestedLimit: "",
    annualIncome: "",
    employmentStatus: "",
    employer: "",
    housingStatus: "",
    monthlyHousing: "",
    existingCards: "",
  });

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Card Type</Label>
          <Select value={formData.cardType} onValueChange={(v) => update("cardType", v)}>
            <SelectTrigger data-testid="select-card-type"><SelectValue placeholder="Select card type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rewards">Rewards Card (1.5% Cash Back)</SelectItem>
              <SelectItem value="travel">Travel Card (2x Points)</SelectItem>
              <SelectItem value="low_interest">Low Interest Card</SelectItem>
              <SelectItem value="secured">Secured Credit Card</SelectItem>
              <SelectItem value="student">Student Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Requested Credit Limit ($)</Label>
          <Input data-testid="input-credit-limit" type="number" placeholder="5000" value={formData.requestedLimit} onChange={(e) => update("requestedLimit", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Annual Income ($)</Label>
          <Input data-testid="input-cc-income" type="number" placeholder="65000" value={formData.annualIncome} onChange={(e) => update("annualIncome", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Employment Status</Label>
          <Select value={formData.employmentStatus} onValueChange={(v) => update("employmentStatus", v)}>
            <SelectTrigger data-testid="select-cc-employment"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-Time Employed</SelectItem>
              <SelectItem value="part_time">Part-Time Employed</SelectItem>
              <SelectItem value="self_employed">Self-Employed</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Employer Name</Label>
          <Input data-testid="input-cc-employer" placeholder="Company Inc." value={formData.employer} onChange={(e) => update("employer", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Housing Status</Label>
          <Select value={formData.housingStatus} onValueChange={(v) => update("housingStatus", v)}>
            <SelectTrigger data-testid="select-housing"><SelectValue placeholder="Select housing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="own">Own</SelectItem>
              <SelectItem value="rent">Rent</SelectItem>
              <SelectItem value="mortgage">Mortgage</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Monthly Housing Payment ($)</Label>
          <Input data-testid="input-housing-payment" type="number" placeholder="1500" value={formData.monthlyHousing} onChange={(e) => update("monthlyHousing", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Number of Existing Credit Cards</Label>
          <Input data-testid="input-existing-cards" type="number" placeholder="2" value={formData.existingCards} onChange={(e) => update("existingCards", e.target.value)} />
        </div>
      </div>
      <Button data-testid="button-submit-cc" className="w-full" disabled={isPending || !formData.requestedLimit}
        onClick={() => onSubmit({ type: "credit_card", formData })}>
        <Send className="w-4 h-4 mr-2" /> Submit Credit Card Application
      </Button>
    </div>
  );
}

export default function ApplyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myApplications } = useQuery({
    queryKey: ["/api/my-applications"],
    queryFn: async () => {
      const res = await fetch("/api/my-applications");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const submitApplication = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit application");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications"] });
      toast({
        title: "Application Submitted",
        description: `Your ${variables.type.replace('_', ' ')} application has been submitted for staff review.`,
      });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message });
    },
  });

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-4 h-4 text-yellow-500" />;
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const loanApps = myApplications?.filter((a: any) => ["loan", "home_equity", "credit_card"].includes(a.type)) || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Apply for Products</h2>
        <p className="text-muted-foreground">Apply for loans, home equity lines, or credit cards. All applications are reviewed by staff.</p>
      </div>

      <Tabs defaultValue="loan" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="loan" data-testid="tab-loan" className="gap-2"><Wallet className="w-4 h-4" /> Personal Loan</TabsTrigger>
          <TabsTrigger value="home_equity" data-testid="tab-equity" className="gap-2"><Home className="w-4 h-4" /> Home Equity</TabsTrigger>
          <TabsTrigger value="credit_card" data-testid="tab-cc" className="gap-2"><CreditCard className="w-4 h-4" /> Credit Card</TabsTrigger>
        </TabsList>

        <TabsContent value="loan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Personal Loan Application</CardTitle>
              <CardDescription>Competitive rates starting at 5.99% APR. Fill out all fields to submit your application.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoanApplicationForm onSubmit={(data) => submitApplication.mutate(data)} isPending={submitApplication.isPending} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="home_equity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Home className="w-5 h-5" /> Home Equity Line of Credit</CardTitle>
              <CardDescription>Borrow against your home's equity. Rates as low as 4.25% APR.</CardDescription>
            </CardHeader>
            <CardContent>
              <HomeEquityForm onSubmit={(data) => submitApplication.mutate(data)} isPending={submitApplication.isPending} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit_card">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Credit Card Application</CardTitle>
              <CardDescription>Choose from rewards, travel, or low-interest options.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreditCardForm onSubmit={(data) => submitApplication.mutate(data)} isPending={submitApplication.isPending} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loanApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Your Applications</CardTitle>
            <CardDescription>Track the status of your submitted applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Type</th>
                    <th className="p-3 text-left font-medium">Date</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loanApps.map((app: any) => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="p-3 capitalize font-medium">{app.type.replace('_', ' ')}</td>
                      <td className="p-3 text-muted-foreground">{app.createdAt ? format(new Date(app.createdAt), "MMM d, yyyy") : "N/A"}</td>
                      <td className="p-3">
                        <Badge variant={app.status === "approved" ? "outline" : app.status === "pending" ? "secondary" : "destructive"} className="gap-1">
                          {statusIcon(app.status)} {app.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {app.rejectionReason && <span className="text-destructive">{app.rejectionReason}</span>}
                        {app.formData?.requestedAmount && <span>${Number(app.formData.requestedAmount).toLocaleString()}</span>}
                        {app.formData?.requestedLimit && <span>Limit: ${Number(app.formData.requestedLimit).toLocaleString()}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
