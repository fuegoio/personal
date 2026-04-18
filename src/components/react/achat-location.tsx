import { useState, useEffect } from "react";
import { Button } from "@/components/react/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/react/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/react/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./ui/input-group";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Share2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { parseAsFloat, parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import en from "../../../public/locales/en.json";
import fr from "../../../public/locales/fr.json";

const locales: Record<string, Record<string, string>> = { en, fr };

function getLang(): string {
  if (typeof localStorage === "undefined") return "fr";
  const stored = localStorage.getItem("lang");
  if (stored && stored in locales) return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return browser in locales ? browser : "fr";
}

function useLang() {
  const [lang, setLang] = useState<string>("fr");

  useEffect(() => {
    setLang(getLang());

    const observer = new MutationObserver(() => {
      setLang(document.documentElement.lang || "fr");
    });
    observer.observe(document.documentElement, { attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  function t(key: string): string {
    return locales[lang]?.[key] ?? locales["fr"]?.[key] ?? key;
  }

  return t;
}

const chartConfig = {
  achat: {
    label: "Buy",
    color: "var(--chart-1)",
  },
  location: {
    label: "Rent",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

// Location calculation function
function calculateLocation(
  loyer: number,
  inflationRate: number,
  tauxPlacement: number,
  years: number,
  achatYearlyPayment: number,
  taxeFonciere: number,
  charges: number,
  travaux: number,
  apport: number,
) {
  const locationSchedule = [];
  let capitalTotalLocation = apport;

  for (let year = 1; year <= years; year++) {
    // Calculate yearly loyer with inflation
    const inflationRateNum =
      typeof inflationRate === "string" ? parseFloat(inflationRate) || 0 : inflationRate;
    const yearlyLoyer = loyer * 12 * Math.pow(1 + inflationRateNum / 100, year - 1);

    // Calculate difference between location payment and achat payment
    const achatTotalPayment = achatYearlyPayment + taxeFonciere + charges + travaux;
    const difference = achatTotalPayment - yearlyLoyer;

    // Calculate placement interests on the cumulative difference
    const placementInterests = capitalTotalLocation * (tauxPlacement / 100);

    // Update capital total for location (initial apport + cumulative difference + placement interests)
    capitalTotalLocation += difference + placementInterests;

    locationSchedule.push({
      year,
      yearlyLoyer,
      difference,
      placementInterests,
      capitalTotalLocation,
    });
  }

  return {
    locationSchedule,
    totalLoyer: locationSchedule.reduce((sum, year) => sum + year.yearlyLoyer, 0),
  };
}

// Mortgage calculation function
function calculateMortgage(
  amount: number,
  principal: number,
  annualInterestRate: number,
  years: number,
  plusValue: number,
  taxeFonciere: number,
  charges: number,
  travaux: number,
  apport: number,
  notaireFees: number,
  inflationRate: number,
) {
  const monthlyInterestRate = annualInterestRate / 100 / 12;
  const numberOfPayments = years * 12;

  // Calculate monthly payment using the formula:
  // M = P [ i(1 + i)^n ] / [ (1 + i)^n - 1]
  const monthlyPayment =
    (principal * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments))) /
    (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);

  // Generate amortization schedule
  const schedule = [];
  let totalPrincipal = 0;
  let remainingBalance = principal;
  let capitalTotal = apport - notaireFees;

  for (let year = 1; year <= years; year++) {
    let yearlyInterest = 0;
    let yearlyPrincipal = 0;

    for (let month = 1; month <= 12; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = monthlyPayment - interestPayment;

      yearlyInterest += interestPayment;
      yearlyPrincipal += principalPayment;
      totalPrincipal += principalPayment;
      remainingBalance -= principalPayment;
    }

    // Calculate plus-value (appreciation of property value)
    const propertyValue = amount * Math.pow(1 + plusValue / 100, year - 1);
    const plusValueAmount = propertyValue * (plusValue / 100);

    // Apply inflation to costs
    const inflatedTaxeFonciere = taxeFonciere * Math.pow(1 + inflationRate / 100, year - 1);
    const inflatedCharges = charges * Math.pow(1 + inflationRate / 100, year - 1);
    const inflatedTravaux = travaux * Math.pow(1 + inflationRate / 100, year - 1);

    // Calculate capital total (yearlyPrincipal - costs + plusValue)
    capitalTotal += yearlyPrincipal + plusValueAmount;

    schedule.push({
      year,
      yearlyPayment: monthlyPayment * 12,
      yearlyPrincipal,
      yearlyInterest,
      totalPrincipal,
      taxeFonciere: inflatedTaxeFonciere,
      charges: inflatedCharges,
      travaux: inflatedTravaux,
      plusValueAmount,
      capitalTotal,
      propertyValue,
    });
  }

  return {
    monthlyPayment,
    totalPayment: monthlyPayment * numberOfPayments,
    totalInterest: monthlyPayment * numberOfPayments - principal,
    schedule,
  };
}

export function AchatLocation() {
  const t = useLang();

  // State for form inputs
  const [amount, setAmount] = useQueryState("amount", parseAsInteger.withDefault(200000));
  const [apport, setApport] = useQueryState("apport", parseAsInteger.withDefault(20000));
  const [taux, setTaux] = useQueryState("taux", parseAsFloat.withDefault(3.5));
  const [duration, setDuration] = useQueryState("duration", parseAsInteger.withDefault(25));
  const [plusValue, setPlusValue] = useQueryState("plusValue", parseAsFloat.withDefault(0.5));
  const [taxeFonciere, setTaxeFonciere] = useQueryState(
    "taxeFonciere",
    parseAsInteger.withDefault(1000),
  );
  const [charges, setCharges] = useQueryState("charges", parseAsInteger.withDefault(1000));
  const [travaux, setTravaux] = useQueryState("travaux", parseAsInteger.withDefault(1500));
  const [propertyType, setPropertyType] = useQueryState(
    "propertyType",
    parseAsString.withDefault("ancien"),
  );
  const [inflationRate, setInflationRate] = useQueryState(
    "inflationRate",
    parseAsFloat.withDefault(2),
  );
  const [loyer, setLoyer] = useQueryState("loyer", parseAsInteger.withDefault(700));
  const [tauxPlacement, setTauxPlacement] = useQueryState(
    "tauxPlacement",
    parseAsFloat.withDefault(3),
  );
  const [surface, setSurface] = useQueryState("surface", parseAsInteger);

  const computeCosts = () => {
    if (!surface) return;
    const taxeFonciereRate = 12.5; // €/m²
    const travauxRate = 15; // €/m²
    const chargesRate = 10; // €/m²

    setTaxeFonciere(surface * taxeFonciereRate);
    setTravaux(surface * travauxRate);
    setCharges(surface * chargesRate);
  };

  // Copy share URL to clipboard
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.toString()).then(() => {
      alert(t("finance.buyvsrent.share.copied"));
    });
  };

  const handleNumericInput = (value: string, setter: (value: number) => void) => {
    const num = parseFloat(value);
    setter(isNaN(num) ? 0 : num);
  };

  // Currency formatter
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate frais de notaire
  const calculateNotaireFees = (propertyAmount: number, type: string) => {
    if (type === "neuf") {
      // For new properties: around 2-3%
      return propertyAmount * 0.025;
    } else {
      // For old properties: around 7-8%
      return propertyAmount * 0.075;
    }
  };

  const notaireFees = calculateNotaireFees(amount, propertyType);
  const totalAmountWithFees = amount + notaireFees;
  const loanAmount = totalAmountWithFees - apport;
  const mortgageData = calculateMortgage(
    amount,
    loanAmount,
    taux,
    duration,
    plusValue,
    taxeFonciere,
    charges,
    travaux,
    apport,
    notaireFees,
    inflationRate,
  );

  // Calculate location data
  const locationData = calculateLocation(
    loyer,
    inflationRate,
    tauxPlacement,
    duration,
    mortgageData.schedule[0].yearlyPayment, // Use first year's payment as base
    taxeFonciere,
    charges,
    travaux,
    apport,
  );

  return (
    <div className="px-4 pb-4">
      <div className="px-3 py-4 border-b border-border/70 flex justify-between items-start flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground">{t("finance.buyvsrent.title")}</h1>
          <p className="mt-2 text-xs text-muted-foreground max-w-4xl">
            {t("finance.buyvsrent.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = window.location.pathname;
            }}
          >
            {t("finance.buyvsrent.reset")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            {t("finance.buyvsrent.share")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 flex-col lg:flex-row">
        <div className="flex flex-col gap-4 max-w-[480px] w-full">
          <hgroup className="px-4 w-full">
            <h2 className="text-lg font-semibold text-foreground/90">
              {t("finance.buyvsrent.params.title")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("finance.buyvsrent.params.subtitle")}
            </p>
          </hgroup>
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {t("finance.buyvsrent.buy.title")}
              </CardTitle>
              <CardDescription>{t("finance.buyvsrent.buy.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <Field>
                    <FieldLabel htmlFor="amount" className="whitespace-nowrap">
                      {t("finance.buyvsrent.buy.amount")}
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="amount"
                        required
                        placeholder="100 000"
                        defaultValue={amount}
                        onChange={(e) => handleNumericInput(e.target.value, setAmount)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>EUR</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("finance.buyvsrent.buy.notaire.legend")}
                  </FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="property-type">
                      {t("finance.buyvsrent.buy.notaire.type")}
                    </FieldLabel>
                    <Select value={propertyType} onValueChange={(value) => setPropertyType(value)}>
                      <SelectTrigger id="property-type" className="w-40">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neuf">
                          {t("finance.buyvsrent.buy.notaire.new")}
                        </SelectItem>
                        <SelectItem value="ancien">
                          {t("finance.buyvsrent.buy.notaire.old")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="p-2 text-xs border text-foreground bg-muted">
                    <p>
                      {t("finance.buyvsrent.buy.notaire.fees")} {formatCurrency(notaireFees)}
                    </p>
                    <p>
                      {t("finance.buyvsrent.buy.notaire.total")}{" "}
                      {formatCurrency(totalAmountWithFees)}
                    </p>
                  </div>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    {t("finance.buyvsrent.buy.loan.legend")}
                  </FieldLegend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="apport" className="whitespace-nowrap">
                        {t("finance.buyvsrent.buy.loan.apport")}
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="apport"
                          required
                          placeholder="10 000"
                          defaultValue={apport}
                          onChange={(e) => handleNumericInput(e.target.value, setApport)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="taux" className="whitespace-nowrap">
                        {t("finance.buyvsrent.buy.loan.taux")}
                      </FieldLabel>
                      <InputGroup className="w-16">
                        <InputGroupInput
                          id="taux"
                          required
                          placeholder="3.00"
                          defaultValue={taux}
                          onChange={(e) => handleNumericInput(e.target.value, setTaux)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="duration">
                        {t("finance.buyvsrent.buy.loan.duration")}
                      </FieldLabel>
                      <Select
                        value={duration.toString()}
                        onValueChange={(value) => setDuration(parseInt(value))}
                      >
                        <SelectTrigger id="duration" className="w-16">
                          <SelectValue placeholder="25" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="15">15</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4" />
                    {t("finance.buyvsrent.buy.costs.legend")}
                  </FieldLegend>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="taxe-fonciere">
                        {t("finance.buyvsrent.buy.costs.taxe")}
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="taxe-fonciere"
                          placeholder="1 000"
                          value={taxeFonciere}
                          onChange={(e) => handleNumericInput(e.target.value, setTaxeFonciere)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="charges" className="whitespace-nowrap">
                        {t("finance.buyvsrent.buy.costs.charges")}
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="charges"
                          placeholder="2 000"
                          value={charges}
                          onChange={(e) => handleNumericInput(e.target.value, setCharges)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="travaux" className="whitespace-nowrap">
                        {t("finance.buyvsrent.buy.costs.travaux")}
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="travaux"
                          placeholder="1 000"
                          value={travaux}
                          onChange={(e) => handleNumericInput(e.target.value, setTravaux)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </FieldGroup>

                  <div className="border p-3 border-gray-300">
                    <div className="flex items-center gap-2 text-xs">
                      <Sparkles className="h-4 w-4" />
                      {t("finance.buyvsrent.buy.costs.auto")}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <InputGroup>
                        <InputGroupInput
                          placeholder="120"
                          defaultValue={surface ?? undefined}
                          onChange={(e) => handleNumericInput(e.target.value, setSurface)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>
                            <span>
                              m<sup>2</sup>
                            </span>
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <Button variant="outline" size="sm" onClick={computeCosts}>
                        {t("finance.buyvsrent.buy.costs.compute")}
                      </Button>
                    </div>
                  </div>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4" />
                    {t("finance.buyvsrent.buy.yield.legend")}
                  </FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="plus-value" className="whitespace-nowrap">
                      {t("finance.buyvsrent.buy.yield.plusvalue")}
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="plus-value"
                        placeholder="1"
                        defaultValue={plusValue}
                        onChange={(e) => handleNumericInput(e.target.value, setPlusValue)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </FieldSet>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {t("finance.buyvsrent.rent.title")}
              </CardTitle>
              <CardDescription>{t("finance.buyvsrent.rent.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="loyer" className="whitespace-nowrap">
                      {t("finance.buyvsrent.rent.loyer")}
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="loyer"
                        required
                        placeholder="1 000"
                        defaultValue={loyer}
                        onChange={(e) => handleNumericInput(e.target.value, setLoyer)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>EUR</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="taux-placement" className="whitespace-nowrap">
                      {t("finance.buyvsrent.rent.placement")}
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="taux-placement"
                        placeholder="3"
                        defaultValue={tauxPlacement}
                        onChange={(e) => handleNumericInput(e.target.value, setTauxPlacement)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>{t("finance.buyvsrent.inflation.title")}</CardTitle>
              <CardDescription>{t("finance.buyvsrent.inflation.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="inflation-rate" className="whitespace-nowrap">
                  {t("finance.buyvsrent.inflation.label")}
                </FieldLabel>
                <InputGroup className="w-40">
                  <InputGroupInput
                    id="inflation-rate"
                    placeholder="2"
                    defaultValue={inflationRate}
                    onChange={(e) => {
                      handleNumericInput(e.target.value, setInflationRate);
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>%</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 lg:border-l lg:pl-4 border-border/70 flex-1 min-w-0">
          <hgroup className="px-4">
            <h2 className="text-lg font-semibold text-foreground/90">
              {t("finance.buyvsrent.simulation.title")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("finance.buyvsrent.simulation.subtitle")}
            </p>
          </hgroup>
          <Card className="h-full flex-1 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b align-bottom [&>th]:whitespace-nowrap [&>th]:pr-2">
                    <th className="p-2 text-left font-medium">
                      {t("finance.buyvsrent.table.year")}
                    </th>
                    <th className="p-2 text-left font-normal border-l">
                      <div className="font-semibold text-foreground text-lg">
                        {t("finance.buyvsrent.buy.title")}
                      </div>
                      <div className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{t("finance.buyvsrent.table.investment")}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="opacity-80">
                              {t("finance.buyvsrent.desc.buy.investment")}
                            </div>
                            <div className="border-t mb-2 mt-2 w-full" />
                            {t("finance.buyvsrent.tooltip.buy.investment.formula")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.costs")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.buy.costs")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.costs.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.savings")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.buy.savings")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.savings.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.gain")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.buy.gain")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.gain.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.capital")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.buy.capital")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.capital.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>

                    <th className="p-2 text-left font-normal border-l">
                      <div className="font-semibold text-foreground text-lg">
                        {t("finance.buyvsrent.rent.title")}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.investment")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.rent.investment")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.investment.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.costs.rent")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.rent.costs")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.costs.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.savings")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t("finance.buyvsrent.tooltip.rent.savings.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.gain")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.rent.gain")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.gain.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t("finance.buyvsrent.table.capital")}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.rent.capital")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.capital.formula")}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {mortgageData.schedule.map((yearData, index) => (
                    <tr
                      key={yearData.year}
                      className="border-b border-border/50 [&>td]:whitespace-nowrap [&>td]:text-right"
                    >
                      <td className="p-2">{yearData.year}</td>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-muted-foreground border-l">
                            {formatCurrency(
                              yearData.yearlyPayment +
                                yearData.taxeFonciere +
                                yearData.charges +
                                yearData.travaux,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.buy.investment")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.investment.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.costs")}
                            <div>
                              {formatCurrency(
                                yearData.taxeFonciere +
                                  yearData.charges +
                                  yearData.travaux +
                                  yearData.yearlyInterest,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.savings")}
                            <div>{formatCurrency(yearData.yearlyPrincipal)}</div>
                          </div>
                          <div className="border-t my-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.investment")}
                            <div>
                              {formatCurrency(
                                yearData.yearlyPayment +
                                  yearData.taxeFonciere +
                                  yearData.charges +
                                  yearData.travaux,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-red-500">
                            {formatCurrency(
                              yearData.taxeFonciere +
                                yearData.charges +
                                yearData.travaux +
                                yearData.yearlyInterest,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.buy.costs")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.costs.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="font-medium">
                            {t("finance.buyvsrent.tooltip.costs.loan")}
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            {t("finance.buyvsrent.tooltip.costs.annual")}
                            <div>
                              {formatCurrency(yearData.yearlyInterest + yearData.yearlyPrincipal)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pl-2">
                            {t("finance.buyvsrent.tooltip.costs.interest")}
                            <div>{formatCurrency(yearData.yearlyInterest)}</div>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground pl-2">
                            {t("finance.buyvsrent.tooltip.costs.principal")}
                            <div>{formatCurrency(yearData.yearlyPrincipal)}</div>
                          </div>
                          <div className="border-t mb-4 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.costs.taxe")}
                            <div>{formatCurrency(yearData.taxeFonciere)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.costs.charges")}
                            <div>{formatCurrency(yearData.charges)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.costs.travaux")}
                            <div>{formatCurrency(yearData.travaux)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.costs.inflation")}
                            <div>
                              {(
                                Math.pow(1 + inflationRate / 100, yearData.year - 1) - 1
                              ).toLocaleString(undefined, {
                                style: "percent",
                                maximumSignificantDigits: 4,
                              })}
                            </div>
                          </div>
                          <div className="border-t mb-4 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.costs")}
                            <div>
                              {formatCurrency(
                                yearData.taxeFonciere +
                                  yearData.charges +
                                  yearData.travaux +
                                  yearData.yearlyInterest,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-violet-500">
                            {formatCurrency(yearData.yearlyPrincipal)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.buy.savings")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.savings.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="font-medium">
                            {t("finance.buyvsrent.tooltip.costs.loan")}
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground gap-4">
                            {t("finance.buyvsrent.tooltip.costs.annual")}
                            <div>
                              {formatCurrency(yearData.yearlyInterest + yearData.yearlyPrincipal)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pl-2 text-muted-foreground">
                            {t("finance.buyvsrent.tooltip.costs.interest")}
                            <div>{formatCurrency(yearData.yearlyInterest)}</div>
                          </div>
                          <div className="flex items-center justify-between pl-2">
                            {t("finance.buyvsrent.tooltip.costs.principal")}
                            <div>{formatCurrency(yearData.yearlyPrincipal)}</div>
                          </div>
                          <div className="border-t mb-4 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.savings")}
                            <div>{formatCurrency(yearData.yearlyPrincipal)}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-green-500 border-l border-border/20">
                            {formatCurrency(yearData.plusValueAmount)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.buy.gain")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.gain.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.gain.value")}
                            <div>{formatCurrency(yearData.propertyValue)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.gain.rate")}
                            <div>
                              {(plusValue / 100).toLocaleString(undefined, {
                                style: "percent",
                              })}
                            </div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.gain.value")}
                            <div>{formatCurrency(yearData.plusValueAmount)}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={cn(
                              "p-2",
                              locationData.locationSchedule[index].capitalTotalLocation >
                                yearData.capitalTotal
                                ? ""
                                : "font-semibold",
                            )}
                          >
                            {formatCurrency(yearData.capitalTotal)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.buy.capital")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.buy.capital.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.existing")}
                            <div>
                              {formatCurrency(
                                mortgageData.schedule[index - 1]?.capitalTotal ||
                                  apport - notaireFees,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.repaid")}
                            <div>{formatCurrency(yearData.yearlyPrincipal)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.gain")}
                            <div>{formatCurrency(yearData.plusValueAmount)}</div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.total")}
                            <div>{formatCurrency(yearData.capitalTotal)}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-muted-foreground border-l">
                            {formatCurrency(
                              yearData.yearlyPayment +
                                yearData.taxeFonciere +
                                yearData.charges +
                                yearData.travaux,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.rent.investment")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.investment.formula")}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-red-500">
                            {formatCurrency(locationData.locationSchedule[index].yearlyLoyer)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.rent.costs")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.costs.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between text-muted-foreground">
                            {t("finance.buyvsrent.tooltip.rent.monthly")}
                            <div>{formatCurrency(loyer)}</div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.annual")}
                            <div>{formatCurrency(loyer * 12)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            {t("finance.buyvsrent.tooltip.rent.inflation")}
                            <div>
                              {(
                                Math.pow(1 + inflationRate / 100, yearData.year - 1) - 1
                              ).toLocaleString(undefined, {
                                style: "percent",
                                maximumSignificantDigits: 4,
                              })}
                            </div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.costs")}
                            <div>
                              {formatCurrency(locationData.locationSchedule[index].yearlyLoyer)}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-violet-500">
                            {formatCurrency(locationData.locationSchedule[index].difference)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.rent.savings")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.savings.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.savings.investment")}
                            <div>
                              {formatCurrency(
                                yearData.yearlyPayment +
                                  yearData.taxeFonciere +
                                  yearData.charges +
                                  yearData.travaux,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.savings.rent")}
                            <div>
                              {formatCurrency(locationData.locationSchedule[index].yearlyLoyer)}
                            </div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.savings.savings")}
                            <div>
                              {formatCurrency(locationData.locationSchedule[index].difference)}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-green-500 border-l border-border/20">
                            {formatCurrency(
                              locationData.locationSchedule[index].placementInterests,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">{t("finance.buyvsrent.desc.rent.gain")}</div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.gain.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.gain.existing")}
                            <div>
                              {formatCurrency(
                                locationData.locationSchedule[index - 1]?.capitalTotalLocation ||
                                  apport,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.gain.rate")}
                            <div>{tauxPlacement}%</div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.table.gain")}
                            <div>
                              {formatCurrency(
                                locationData.locationSchedule[index].placementInterests,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={cn(
                              "p-2",
                              locationData.locationSchedule[index].capitalTotalLocation >
                                yearData.capitalTotal
                                ? "font-semibold"
                                : "",
                            )}
                          >
                            {formatCurrency(
                              locationData.locationSchedule[index].capitalTotalLocation,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="opacity-80">
                            {t("finance.buyvsrent.desc.rent.capital")}
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          {t("finance.buyvsrent.tooltip.rent.capital.formula")}
                          <div className="border-t mb-6 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.existing")}
                            <div>
                              {formatCurrency(
                                locationData.locationSchedule[index - 1]?.capitalTotalLocation ||
                                  apport,
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.rent.capital.savings")}
                            <div>
                              {formatCurrency(locationData.locationSchedule[index].difference)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.gain")}
                            <div>
                              {formatCurrency(
                                locationData.locationSchedule[index].placementInterests,
                              )}
                            </div>
                          </div>
                          <div className="border-t mb-2 mt-2 w-full" />
                          <div className="flex items-center justify-between">
                            {t("finance.buyvsrent.tooltip.capital.total")}
                            <div>
                              {formatCurrency(
                                locationData.locationSchedule[index].capitalTotalLocation,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ChartContainer config={chartConfig} className="p-4 h-[420px]">
              <LineChart
                accessibilityLayer
                data={mortgageData.schedule.map((yearData, index) => ({
                  year: yearData.year,
                  achat: yearData.capitalTotal,
                  location: locationData.locationSchedule[index].capitalTotalLocation,
                }))}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" tickLine={false} tickMargin={8} />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  tickLine={false}
                  tickMargin={8}
                  width={100}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      valueFormatter={(value) => formatCurrency(value)}
                    />
                  }
                />
                <Line
                  dataKey="achat"
                  type="monotone"
                  stroke="var(--color-achat)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="location"
                  type="monotone"
                  stroke="var(--color-location)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
