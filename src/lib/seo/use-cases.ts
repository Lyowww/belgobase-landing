import type { Locale } from "@/i18n/config";

export const useCaseSlugs = ["bedrijven-zoeken", "prospectielijsten", "klantenbestand-analyseren", "bedrijfsanalyse"] as const;
export type UseCaseSlug = typeof useCaseSlugs[number];
type UseCase = { title: string; description: string; question: string; intro: string; steps: [string, string][]; result: string; boundary: string; criteria?: [string, string][] };

const nl: Record<UseCaseSlug, UseCase> = {
  "bedrijven-zoeken": {
    title: "Belgische bedrijven zoeken op sector en regio",
    description: "Vind Belgische bedrijven op activiteit, postcode en beschikbare financiële gegevens. Bespreek uw doelgroep met AI, verfijn de selectie en exporteer naar Excel.",
    question: "Ik lever aan bedrijven in de regio Mechelen. Help me een doelgroep kiezen die bij mijn aanbod past.",
    intro: "Zoekt u één onderneming of wilt u een hele doelgroep samenstellen? Zoek rechtstreeks op bedrijfsnaam of ondernemingsnummer, of vertel de BelgoBase-assistent wat u verkoopt en welke bedrijven u wilt bereiken. U ziet de voorgestelde criteria en houdt zelf de controle over uw selectie.",
    steps: [["Beschrijf wie u zoekt", "Vertel over uw aanbod, uw werkgebied en de kenmerken van een goede klant. U kunt ook zelf beginnen met de filters in Werkruimte."], ["Controleer de bedrijven", "Bekijk de voorgestelde doelgroep, combineer criteria en onderzoek de beschikbare bedrijfsgegevens. Verbreed of versmal uw selectie waar nodig."], ["Neem uw selectie mee", "Kies de kolommen die u nodig hebt en exporteer naar Excel. Wilt u contactgegevens toevoegen, dan kunt u beschikbare gegevens op bedrijfswebsites laten onderzoeken."]],
    criteria: [["Sector en NACEBEL-activiteit", "Selecteer activiteiten die bij uw aanbod passen. Een activiteitencode beschrijft een geregistreerde activiteit; bekijk ook het bedrijf zelf voordat u het benadert."], ["Regio, gemeente en postcode", "Baken uw werkgebied af met Belgische locatiecriteria. De selectie volgt het beschikbare KBO-bedrijfsadres; dat is niet noodzakelijk iedere locatie waar een onderneming actief is."], ["Personeel en financiële gegevens", "Combineer uw doelgroep met beschikbare VTE- en financiële gegevens. VTE staat voor voltijdsequivalenten en is niet hetzelfde als het aantal personen. Niet ieder bedrijf publiceert omzet of een volledige jaarrekening."], ["Rechtsvorm en rechtstoestand", "Maak onderscheid tussen de rechtsvorm van een onderneming en haar juridische toestand. Gebruik de beschikbare opname- en uitsluitingsfilters om uw selectie verder te verfijnen."]],
    result: "Een gerichte Belgische bedrijvenlijst met de velden die u zelf hebt gekozen. U kunt de selectie verder onderzoeken en gebruiken voor uw commerciële voorbereiding.",
    boundary: "Een bedrijf dat aan uw criteria voldoet, heeft niet automatisch interesse in uw aanbod. De beschikbaarheid van contactgegevens en financiële cijfers verschilt per onderneming.",
  },
  prospectielijsten: {
    title: "Een prospectielijst maken van Belgische bedrijven",
    description: "Beschrijf uw doelgroep aan BelgoBase. Verfijn Belgische bedrijven met AI, onderzoek beschikbare contactgegevens en exporteer uw prospectielijst naar Excel.",
    question: "Ik lever fruit op het werk. Zoek bedrijven rond Mechelen met minstens 20 medewerkers.",
    intro: "U weet wat u verkoopt. Maar welke bedrijven passen daarbij? Begin met uw verhaal: uw aanbod, uw werkgebied en het soort klant dat u wilt bereiken. De BelgoBase-assistent helpt u daarvan een concrete bedrijfsselectie te maken.",
    steps: [["Maak uw doelgroep concreet", "Bespreek regio, sector, bedrijfsgrootte en gewenste kenmerken. De assistent vraagt verduidelijking waar nodig; u bevestigt de voorgestelde doelgroep."], ["Bekijk en verfijn de selectie", "Controleer de gevonden bedrijven en pas uw vraag aan in het gesprek. In Werkruimte kunt u ook zelf filters gebruiken en beschikbare bedrijfsgegevens bekijken."], ["Bereid uw prospectie voor", "Onderzoek beschikbare contactgegevens op bedrijfswebsites. Kies de gewenste kolommen en download uw selectie naar Excel."]],
    result: "Een herbruikbare bedrijvenlijst met uw gekozen gegevens, voor de voorbereiding van uw volgende prospectieronde.",
    boundary: "Een passend bedrijf is nog geen geïnteresseerde klant. Contactgegevens zijn niet voor elk bedrijf beschikbaar. BelgoBase garandeert geen afspraken of verkoopresultaten.",
  },
  "klantenbestand-analyseren": {
    title: "Uw klantenbestand als vertrekpunt voor nieuwe prospectie",
    description: "Upload een Excel- of CSV-klantenlijst in BelgoBase, bespreek uw doelgroep met de AI-assistent en werk verder naar een gerichte Belgische prospectieselectie.",
    question: "Dit zijn mijn klanten. Help me bepalen welke soort bedrijven ik verder moet benaderen.",
    intro: "Een nieuwe selectie hoeft niet bij nul te beginnen. Breng uw bestaande klantenbestand mee en leg uit welke klanten goed bij uw bedrijf passen. Combineer die context met uw eigen ervaring en de beschikbare Belgische bedrijfsgegevens.",
    steps: [["Breng uw lijst mee", "Upload uw Excel- of CSV-bestand en controleer hoe de kolommen worden herkend. Geef aan of het om klanten of prospects gaat, zodat de lijst de juiste rol krijgt."], ["Bespreek wat een goede klant maakt", "Vertel welke opdrachten, sectoren of regio's voor u interessant zijn. Laat de assistent helpen bij het formuleren van een doelgroep en controleer het voorstel."], ["Werk verder met een gerichte selectie", "Zoek Belgische bedrijven op de bevestigde criteria. Verfijn de selectie, controleer de gegevens en kies wat u naar Excel wilt meenemen."]],
    result: "Een expliciete doelgroep en een nieuwe selectie die aansluit bij de context die u hebt meegegeven.",
    boundary: "De tijdelijke upload ondersteunt Excel en CSV tot 5.000 rijen en 4 MB. Gebruik alleen gegevens die u hiervoor mag verwerken. Een upload is geen automatische CRM-koppeling of garantie op identieke klanten.",
  },
  bedrijfsanalyse: {
    title: "Belgische bedrijven beoordelen met KBO- en NBB-gegevens",
    description: "Zoek Belgische ondernemingen, bekijk beschikbare NBB-jaarrekeningen en financiële evolutie, en neem relevante bedrijfsgegevens mee naar Excel.",
    question: "Welke bedrijven in mijn selectie passen qua omvang en financiële cijfers bij mijn aanbod?",
    intro: "Een naam op een lijst vertelt niet het hele verhaal. Onderzoek de beschikbare bedrijfskenmerken en financiële evolutie voordat u een prospect prioriteit geeft. BelgoBase brengt de selectie en de bedrijfsfiche samen.",
    steps: [["Zoek of open een bedrijf", "Zoek op bedrijfsnaam of ondernemingsnummer, of open een onderneming vanuit uw bestaande selectie."], ["Bekijk de beschikbare cijfers", "Raadpleeg bedrijfskenmerken, VTE en financiële historiek. Grafieken helpen de evolutie te lezen wanneer er voldoende bruikbare bronjaren zijn."], ["Neem de relevante gegevens mee", "Verfijn uw selectie met beschikbare financiële criteria en kies de kolommen voor uw Excel-export."]],
    result: "Een beter onderbouwde selectie, met bedrijfsinformatie en beschikbare cijfers naast elkaar.",
    boundary: "Niet elke onderneming publiceert alle cijfers. Een ontbrekende waarde is geen nul. BelgoBase biedt geen garantie over kredietwaardigheid of toekomstig betaalgedrag.",
  },
};
const en: Record<UseCaseSlug, UseCase> = {
  "bedrijven-zoeken": {
    title: "Find Belgian companies by industry and region",
    description: "Find Belgian companies by activity, postcode and available financial data. Discuss your target market with AI, refine your selection and export to Excel.",
    question: "I supply businesses around Mechelen. Help me choose a target market that fits my offer.",
    intro: "Looking for one company or building an entire target list? Search directly by company name or enterprise number, or tell the BelgoBase assistant what you sell and who you want to reach. Review the proposed criteria and stay in control of your selection.",
    steps: [["Describe your target", "Explain your offer, service area and the characteristics of a good customer. You can also start directly with the filters in Workspace."], ["Review the companies", "Check the proposed target market, combine criteria and examine the available company information. Broaden or narrow your selection where needed."], ["Export your selection", "Choose the columns you need and export to Excel. If you need contact details, you can research available information on company websites."]],
    criteria: [["Industry and NACEBEL activity", "Select activities that fit your offer. An activity code describes a registered activity; review the business itself before approaching it."], ["Region, municipality and postcode", "Define your service area using Belgian location criteria. The selection follows the available KBO company address, which does not necessarily cover every location where a business operates."], ["Staff and financial information", "Combine your target criteria with available FTE and financial data. FTE means full-time equivalents, not headcount. Not every company publishes revenue or a complete set of annual accounts."], ["Legal form and legal status", "Distinguish a company's legal form from its legal status. Use the available inclusion and exclusion filters to refine your selection."]],
    result: "A focused Belgian company list with the fields you chose. Continue researching your selection and use it to prepare your sales work.",
    boundary: "Matching your criteria does not mean a company is interested in your offer. Contact details and financial figures are not available for every company.",
  },
  prospectielijsten: {
    title: "Build a prospect list of Belgian companies",
    description: "Describe your target market to BelgoBase. Refine Belgian companies with AI, research available contact details and export your prospect list to Excel.",
    question: "I deliver fruit to workplaces. Find companies around Mechelen with at least 20 employees.",
    intro: "You know what you sell. Which companies are a good fit? Start with your offer, your service area and the customers you want to reach. The BelgoBase assistant helps turn that context into a company selection.",
    steps: [["Define your target market", "Discuss region, sector, company size and relevant characteristics. The assistant asks for clarification where needed; you confirm the proposed target criteria."], ["Review and refine", "Inspect the companies and adjust your request in the conversation. Switch to Workspace to use filters and inspect available company information yourself."], ["Prepare your outreach", "Research available contact details on company websites. Choose the columns you need and download your selection to Excel."]],
    result: "A reusable company list with your chosen fields, ready to support your next prospecting campaign.",
    boundary: "A matching company is not necessarily an interested buyer. Contact details are not available for every company. BelgoBase does not guarantee appointments or sales.",
  },
  "klantenbestand-analyseren": {
    title: "Use your customer list to shape your next prospecting campaign",
    description: "Upload an Excel or CSV customer list to BelgoBase, discuss your target market with the AI assistant and build a focused Belgian company selection.",
    question: "These are my customers. Help me decide which kinds of companies to approach next.",
    intro: "Your next selection does not have to start from scratch. Bring your customer list and explain what makes a customer a good fit. Combine that context with your experience and available Belgian company information.",
    steps: [["Bring your list", "Upload an Excel or CSV file and check the recognised columns. Identify it as customers or prospects so it is used in the right context."], ["Discuss your ideal customer", "Explain which projects, industries and regions matter. Work with the assistant to define your target criteria, then review the proposal."], ["Build a focused selection", "Find Belgian companies using your confirmed criteria. Refine the selection, inspect the data and choose what to export to Excel."]],
    result: "Explicit target criteria and a new selection informed by the context you provided.",
    boundary: "Temporary uploads support Excel and CSV up to 5,000 rows and 4 MB. Only upload data you are entitled to process. Uploading is not an automatic CRM integration or a guarantee of identical customers.",
  },
  bedrijfsanalyse: {
    title: "Assess Belgian companies using KBO and NBB information",
    description: "Find Belgian companies, review available NBB annual accounts and financial trends, and export relevant company information to Excel.",
    question: "Which companies in my selection fit my offer in terms of size and financial figures?",
    intro: "A name on a list is only a starting point. Review available company characteristics and financial trends before prioritising a prospect. BelgoBase connects your selection with each company profile.",
    steps: [["Find or open a company", "Search by company name or enterprise number, or open a company from your existing selection."], ["Review available figures", "Explore company characteristics, FTE and financial history. Charts show trends when enough usable reporting years are available."], ["Take the relevant data with you", "Refine your selection using available financial criteria and choose which columns to export to Excel."]],
    result: "A more informed selection, with company information and available financial figures together.",
    boundary: "Not every company publishes every figure. Missing does not mean zero. BelgoBase does not guarantee creditworthiness or future payment behaviour.",
  },
};
export function getUseCase(locale: Locale, slug: UseCaseSlug): UseCase { return (locale === "nl" ? nl : en)[slug]; }
