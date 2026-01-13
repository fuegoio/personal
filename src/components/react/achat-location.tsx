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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "./ui/input-group";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";

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
      typeof inflationRate === "string"
        ? parseFloat(inflationRate) || 0
        : inflationRate;
    const yearlyLoyer =
      loyer * 12 * Math.pow(1 + inflationRateNum / 100, year - 1);

    // Calculate difference between location payment and achat payment
    const achatTotalPayment =
      achatYearlyPayment + taxeFonciere + charges + travaux;
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
    totalLoyer: locationSchedule.reduce(
      (sum, year) => sum + year.yearlyLoyer,
      0,
    ),
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
    (principal *
      (monthlyInterestRate *
        Math.pow(1 + monthlyInterestRate, numberOfPayments))) /
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
    const inflationRateNum =
      typeof inflationRate === "string"
        ? parseFloat(inflationRate) || 0
        : inflationRate;
    const inflatedTaxeFonciere =
      taxeFonciere * Math.pow(1 + inflationRateNum / 100, year - 1);
    const inflatedCharges =
      charges * Math.pow(1 + inflationRateNum / 100, year - 1);
    const inflatedTravaux =
      travaux * Math.pow(1 + inflationRateNum / 100, year - 1);

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
  // State for form inputs
  const [amount, setAmount] = useQueryState(
    "amount",
    parseAsInteger.withDefault(200000),
  );
  const [apport, setApport] = useQueryState(
    "apport",
    parseAsInteger.withDefault(20000),
  );
  const [taux, setTaux] = useQueryState("taux", parseAsFloat.withDefault(3.5));
  const [duration, setDuration] = useQueryState(
    "duration",
    parseAsInteger.withDefault(25),
  );
  const [plusValue, setPlusValue] = useQueryState(
    "plusValue",
    parseAsFloat.withDefault(0.5),
  );
  const [taxeFonciere, setTaxeFonciere] = useQueryState(
    "taxeFonciere",
    parseAsInteger.withDefault(1000),
  );
  const [charges, setCharges] = useQueryState(
    "charges",
    parseAsInteger.withDefault(1000),
  );
  const [travaux, setTravaux] = useQueryState(
    "travaux",
    parseAsInteger.withDefault(1500),
  );
  const [propertyType, setPropertyType] = useQueryState(
    "propertyType",
    parseAsString.withDefault("ancien"),
  );
  const [inflationRate, setInflationRate] = useQueryState(
    "inflationRate",
    parseAsFloat.withDefault(2),
  );
  const [loyer, setLoyer] = useQueryState(
    "loyer",
    parseAsInteger.withDefault(700),
  );
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
      alert("Lien de partage copié dans le presse-papiers !");
    });
  };

  const handleNumericInput = (
    value: string,
    setter: (value: number) => void,
  ) => {
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
    <div className="p-4">
      <div className="px-3 py-4 border-b border-border/70 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">
            Achat vs Location
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Comparaison entre l'achat et la location d'un bien immobilier.
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
            Réinitialiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Partager
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="flex flex-col gap-4">
          <div className="px-4 w-[480px]">
            <div className="text-lg font-semibold text-foreground/70">
              Parametres
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vos paramètres pour la simulation.
            </p>
          </div>
          <Card className="w-[480px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Achat</CardTitle>
              <CardDescription>
                Donnez les informations sur l'achat du bien immobilier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <Field>
                    <FieldLabel htmlFor="amount" className="whitespace-nowrap">
                      Montant d'achat du bien
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="amount"
                        required
                        placeholder="100 000"
                        defaultValue={amount}
                        onChange={(e) =>
                          handleNumericInput(e.target.value, setAmount)
                        }
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
                    Frais de notaire
                  </FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="property-type">
                      Type de bien
                    </FieldLabel>
                    <Select
                      value={propertyType}
                      onValueChange={(value) => setPropertyType(value)}
                    >
                      <SelectTrigger id="property-type" className="w-40">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neuf">Neuf (2,5%)</SelectItem>
                        <SelectItem value="ancien">Ancien (7,5%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="p-2 text-xs border text-foreground bg-muted">
                    <p>Frais de notaire: {formatCurrency(notaireFees)}</p>
                    <p>
                      Montant total avec frais:{" "}
                      {formatCurrency(totalAmountWithFees)}
                    </p>
                  </div>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Emprunt
                  </FieldLegend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel
                        htmlFor="apport"
                        className="whitespace-nowrap"
                      >
                        Apport
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="apport"
                          required
                          placeholder="10 000"
                          defaultValue={apport}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setApport)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="taux" className="whitespace-nowrap">
                        Taux d'intérêt
                      </FieldLabel>
                      <InputGroup className="w-16">
                        <InputGroupInput
                          id="taux"
                          required
                          placeholder="3.00"
                          defaultValue={taux}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setTaux)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="duration">Durée du prêt</FieldLabel>
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
                    Couts du bien
                  </FieldLegend>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="taxe-fonciere">
                        Taxe foncière annuelle
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="taxe-fonciere"
                          placeholder="1 000"
                          value={taxeFonciere}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setTaxeFonciere)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="charges"
                        className="whitespace-nowrap"
                      >
                        Charges annuelles
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="charges"
                          placeholder="2 000"
                          value={charges}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setCharges)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>EUR</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel
                        htmlFor="travaux"
                        className="whitespace-nowrap"
                      >
                        Travaux annuels
                      </FieldLabel>
                      <InputGroup className="w-40">
                        <InputGroupInput
                          id="travaux"
                          placeholder="1 000"
                          value={travaux}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setTravaux)
                          }
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
                      Ajuster automatiquement les coûts
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <InputGroup>
                        <InputGroupInput
                          placeholder="120"
                          defaultValue={surface ?? undefined}
                          onChange={(e) =>
                            handleNumericInput(e.target.value, setSurface)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>
                            <span>
                              m<sup>2</sup>
                            </span>
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={computeCosts}
                      >
                        Calculer
                      </Button>
                    </div>
                  </div>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4" />
                    Rendement du bien
                  </FieldLegend>
                  <Field>
                    <FieldLabel
                      htmlFor="plus-value"
                      className="whitespace-nowrap"
                    >
                      Plus-value annuelle
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="plus-value"
                        placeholder="1"
                        defaultValue={plusValue}
                        onChange={(e) =>
                          handleNumericInput(e.target.value, setPlusValue)
                        }
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

          <Card className="w-[480px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Location</CardTitle>
              <CardDescription>
                Donnez les informations sur la location du bien immobilier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="loyer" className="whitespace-nowrap">
                      Loyer mensuel
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="loyer"
                        required
                        placeholder="1 000"
                        defaultValue={loyer}
                        onChange={(e) =>
                          handleNumericInput(e.target.value, setLoyer)
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>EUR</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="taux-placement"
                      className="whitespace-nowrap"
                    >
                      Taux de placement de la différence
                    </FieldLabel>
                    <InputGroup className="w-40">
                      <InputGroupInput
                        id="taux-placement"
                        placeholder="3"
                        defaultValue={tauxPlacement}
                        onChange={(e) =>
                          handleNumericInput(e.target.value, setTauxPlacement)
                        }
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

          <Card className="w-[480px]">
            <CardHeader>
              <CardTitle>Taux d'inflation</CardTitle>
              <CardDescription>
                Taux d'inflation annuel qui influence les loyers, taxes
                foncières, charges et travaux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel
                  htmlFor="inflation-rate"
                  className="whitespace-nowrap"
                >
                  Taux d'inflation annuel
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

        <div className="flex flex-col gap-4 border-l pl-4 border-border/70 flex-1 min-w-0">
          <div className="px-4 w-[480px]">
            <div className="text-lg font-semibold text-foreground/70">
              Simulation
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comparaison entre l'achat et la location du bien immobilier.
            </p>
          </div>
          <Card className="h-full flex-1 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b align-bottom [&>th]:whitespace-nowrap [&>th]:pr-2">
                    <th className="p-2 text-left font-medium">Année</th>
                    <th className="p-2 text-left font-normal border-l">
                      <div className="font-semibold text-foreground text-lg">
                        Achat
                      </div>
                      <div className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>Investissement</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Investissement = Coûts + Epargne
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Coûts</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Coûts = Taxe foncière + Charges + Travaux + Intérêts
                          payés
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Epargne</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Epargne = Capital remboursé
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Plus-value</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Plus-value = Valeur du bien * Taux de plus-value
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Capital total</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Capital total = Capital existant + Capital remboursé +
                          Plus-value
                        </TooltipContent>
                      </Tooltip>
                    </th>

                    <th className="p-2 text-left font-normal border-l">
                      <div className="font-semibold text-foreground text-lg">
                        Location
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Investissement</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Investissement = Meme investissement que en achat
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Coûts (loyer)</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Loyer annuel = Loyer mensuel * 12
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Epargne</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Epargne = Investissement - Loyer
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left font-normal text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Plus-value</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Intérêts de placement = Capital existant * Taux de
                          placement
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="p-2 text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>Capital total</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Capital total = Capital existant + Epargne + Intérêts
                          de placement
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
                          Investissement = Coûts + Epargne
                          <br />
                          <br />
                          {formatCurrency(
                            yearData.yearlyPayment +
                              yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux,
                          )}{" "}
                          ={" "}
                          {formatCurrency(
                            yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux +
                              yearData.yearlyInterest,
                          )}{" "}
                          + {formatCurrency(yearData.yearlyPrincipal)}
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
                          Coûts = Taxe foncière + Charges + Travaux + Intérêts
                          payés
                          <br />
                          <br />
                          {formatCurrency(
                            yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux +
                              yearData.yearlyInterest,
                          )}{" "}
                          = {formatCurrency(yearData.taxeFonciere)} +{" "}
                          {formatCurrency(yearData.charges)} +{" "}
                          {formatCurrency(yearData.travaux)} +{" "}
                          {formatCurrency(yearData.yearlyInterest)}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-violet-500">
                            {formatCurrency(yearData.yearlyPrincipal)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Epargne = Capital remboursé
                          <br />
                          <br />
                          {formatCurrency(yearData.yearlyPrincipal)} ={" "}
                          {formatCurrency(yearData.yearlyPrincipal)}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-green-500 border-l border-border/20">
                            {formatCurrency(yearData.plusValueAmount)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Plus-value = Valeur du bien * Taux de plus-value
                          <br />
                          <br />
                          {formatCurrency(yearData.plusValueAmount)} ={" "}
                          {formatCurrency(yearData.propertyValue)} * {plusValue}
                          %
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={cn(
                              "p-2",
                              locationData.locationSchedule[index]
                                .capitalTotalLocation > yearData.capitalTotal
                                ? ""
                                : "font-semibold",
                            )}
                          >
                            {formatCurrency(yearData.capitalTotal)}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Capital total = Capital existant + Capital remboursé +
                          Plus-value
                          <br />
                          <br />
                          {formatCurrency(yearData.capitalTotal)} ={" "}
                          {formatCurrency(
                            mortgageData.schedule[index - 1]?.capitalTotal ||
                              apport - notaireFees,
                          )}{" "}
                          + {formatCurrency(yearData.yearlyPrincipal)} +{" "}
                          {formatCurrency(yearData.plusValueAmount)}
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
                          Investissement = Meme investissement que en achat
                          <br />
                          <br />
                          {formatCurrency(
                            yearData.yearlyPayment +
                              yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux,
                          )}{" "}
                          ={" "}
                          {formatCurrency(
                            yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux +
                              yearData.yearlyPayment,
                          )}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-red-500">
                            {formatCurrency(
                              locationData.locationSchedule[index].yearlyLoyer,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Loyer annuel = Loyer mensuel * 12
                          <br />
                          <br />
                          {formatCurrency(
                            locationData.locationSchedule[index].yearlyLoyer,
                          )}{" "}
                          = {formatCurrency(loyer)} * 12
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-violet-500">
                            {formatCurrency(
                              locationData.locationSchedule[index].difference,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Epargne = Investissement - Loyer
                          <br />
                          <br />
                          {formatCurrency(
                            locationData.locationSchedule[index].difference,
                          )}{" "}
                          ={" "}
                          {formatCurrency(
                            yearData.yearlyPayment +
                              yearData.taxeFonciere +
                              yearData.charges +
                              yearData.travaux,
                          )}{" "}
                          -{" "}
                          {formatCurrency(
                            locationData.locationSchedule[index].yearlyLoyer,
                          )}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td className="p-2 text-green-500 border-l border-border/20">
                            {formatCurrency(
                              locationData.locationSchedule[index]
                                .placementInterests,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Intérêts de placement = Capital existant * Taux de
                          placement
                          <br />
                          <br />
                          {formatCurrency(
                            locationData.locationSchedule[index]
                              .placementInterests,
                          )}{" "}
                          ={" "}
                          {formatCurrency(
                            locationData.locationSchedule[index - 1]
                              ?.capitalTotalLocation || apport,
                          )}{" "}
                          * {tauxPlacement}%
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <td
                            className={cn(
                              "p-2",
                              locationData.locationSchedule[index]
                                .capitalTotalLocation > yearData.capitalTotal
                                ? "font-semibold"
                                : "",
                            )}
                          >
                            {formatCurrency(
                              locationData.locationSchedule[index]
                                .capitalTotalLocation,
                            )}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Capital total = Capital existant + Epargne + Intérêts
                          de placement
                          <br />
                          <br />
                          {formatCurrency(
                            locationData.locationSchedule[index]
                              .capitalTotalLocation,
                          )}{" "}
                          ={" "}
                          {formatCurrency(
                            locationData.locationSchedule[index - 1]
                              ?.capitalTotalLocation || apport,
                          )}{" "}
                          +{" "}
                          {formatCurrency(
                            locationData.locationSchedule[index].difference,
                          )}{" "}
                          +{" "}
                          {formatCurrency(
                            locationData.locationSchedule[index]
                              .placementInterests,
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
