import type { Locale } from "@/i18n/config";

export type Capability = {
  title: string;
  description: string;
};
export type CapabilityGroup = {
  title: string;
  intro: string;
  access: "workspace" | "public";
  items: Capability[];
};

type CapabilitiesPageCopy = {
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  workspaceLabel: string;
  workspaceTitle: string;
  workspaceDescription: string;
  publicLabel: string;
  publicTitle: string;
  publicDescription: string;
  demoCta: string;
  workspaceCta: string;
  lookupCta: string;
  useCasesTitle: string;
  useCasesIntro: string;
  useCaseLinkLabel: string;
  groups: CapabilityGroup[];
};

export const capabilitiesCopy: Record<Locale, CapabilitiesPageCopy> = {
  nl: {
    metadataTitle: "Mogelijkheden van BelgoBase | Zoeken, analyseren en exporteren",
    metadataDescription: "Ontdek 15 concrete mogelijkheden van BelgoBase voor bedrijfsselectie, prospectielijsten, analyse, Excel-export en de gratis publieke bedrijfsfiche.",
    eyebrow: "15 concrete mogelijkheden",
    title: "Van brede bedrijfsvraag naar een bruikbare selectie",
    intro: "BelgoBase brengt zoeken, selecteren, analyseren en exporteren samen. Bekijk hieronder wat u in de betaalde werkruimte kunt doen en welke informatie u gratis op de publieke bedrijfsfiche kunt raadplegen.",
    workspaceLabel: "Betaalde werkruimte",
    workspaceTitle: "Selecties opbouwen en ermee werken",
    workspaceDescription: "De werkruimte is bedoeld voor gerichte bedrijfsselecties, analyse, gespreksondersteuning en Excel-export. Een actief BelgoBase-account is vereist.",
    publicLabel: "Gratis publieke fiche",
    publicTitle: "Eén rechtspersoon gratis opzoeken",
    publicDescription: "De publieke fiche werkt zonder account voor één bedrijf per zoekopdracht. Ze biedt geen bulkselectie of bulkexport.",
    demoCta: "Vraag een demo aan",
    workspaceCta: "Open de werkruimte",
    lookupCta: "Zoek gratis één bedrijf op",
    useCasesTitle: "Vertrek vanuit uw concrete vraag",
    useCasesIntro: "Bekijk hoe de mogelijkheden samenkomen in vier herkenbare toepassingen.",
    useCaseLinkLabel: "Bekijk de toepassing",
    groups: [
      {
        title: "Bedrijven zoeken en afbakenen",
        intro: "Bouw een selectie op met de beschikbare officiële bedrijfsgegevens.",
        access: "workspace",
        items: [
          { title: "Belgische bedrijven zoeken", description: "Zoek met BelgoBase Belgische ondernemingen en stel een selectie samen op basis van de beschikbare bedrijfsgegevens." },
          { title: "Selecteren op sector en NACE-BEL", description: "Baken uw doelgroep af met sectoren en geregistreerde NACE-BEL-activiteiten. Controleer de gevonden bedrijven op aansluiting bij uw aanbod." },
          { title: "Selecteren op regio en postcode", description: "Zoek bedrijven op gewest, gemeente of postcode met de beschikbare KBO-adresgegevens. Een geregistreerd adres beschrijft niet alle plaatsen waar een bedrijf actief is." },
          { title: "Selecteren op bedrijfsomvang", description: "Verfijn uw bedrijfsselectie met beschikbare VTE-gegevens. VTE is een maat voor arbeidsvolume en staat niet gelijk aan het aantal personen." },
          { title: "Filteren op rechtsvorm en status", description: "Gebruik beschikbare rechtsvormen en juridische statussen om uw bedrijfsselectie af te bakenen. Bekijk de brongegevens bij de gevonden onderneming." },
        ],
      },
      {
        title: "Van selectie naar werkbare lijst",
        intro: "Verfijn uw doelgroep, behoud de context en neem de gekozen gegevens mee naar uw eigen werk.",
        access: "workspace",
        items: [
          { title: "B2B-prospectielijsten samenstellen", description: "Stel in BelgoBase een bedrijvenlijst samen voor uw commerciële voorbereiding. Beoordeel zelf welke ondernemingen passen voordat u ze verder opvolgt." },
          { title: "Selecties exporteren naar Excel", description: "Exporteer gekozen bedrijven en beschikbare kolommen uit uw BelgoBase-selectie naar Excel voor verdere verwerking in uw eigen werk." },
          { title: "Doelgroep bepalen via gesprek", description: "Beschrijf uw aanbod en klantkennis in het BelgoBase-gesprek. De assistent stelt selectiecriteria en bedrijven voor; u controleert de aannames en de aansluiting." },
          { title: "Selecties verfijnen in de werkruimte", description: "Bekijk de gebruikte filters en gevonden bedrijven in de werkruimte. Pas uw criteria aan en gebruik de zoekgeschiedenis om uw selectie verder bij te stellen." },
          { title: "Eigen klantenbestand als vertrekpunt", description: "Gebruik tijdelijk een eigen Excel- of CSV-klantenlijst als context voor een doelgroepvoorstel. U beoordeelt de voorgestelde criteria; dit is geen CRM of gegarandeerde automatische koppeling." },
        ],
      },
      {
        title: "Bedrijven en cijfers begrijpen",
        intro: "Raadpleeg beschikbare brongegevens en vergelijk financiële jaren zonder ontbrekende waarden in te vullen.",
        access: "workspace",
        items: [
          { title: "Bedrijfsgegevens raadplegen", description: "Bekijk de beschikbare KBO-basisgegevens van een onderneming, zoals ondernemingsnummer, geregistreerde activiteit en juridische kenmerken." },
          { title: "Beschikbare financiële cijfers bekijken", description: "Raadpleeg beschikbare NBB-kerncijfers met hun bron en boekjaar. Niet elke onderneming publiceert dezelfde gegevens; ontbrekende waarden blijven onbekend." },
          { title: "Financiële historiek vergelijken", description: "Vergelijk beschikbare boekjaren en bekijk financiële ontwikkelingen in grafieken. Houd rekening met ontbrekende jaren en verschillen in de gepubliceerde cijfers." },
        ],
      },
      {
        title: "Gratis publieke bedrijfsfiche",
        intro: "Zoek zonder account één rechtspersoon op en verken de beschikbare informatie.",
        access: "public",
        items: [
          { title: "Eén bedrijf opzoeken", description: "Zoek op de BelgoBase-website gratis één rechtspersoon op via naam of ondernemings-/btw-nummer. Bekijk beschikbare KBO- en NBB-gegevens zonder account; deze route biedt geen bulkexport." },
          { title: "Vergelijkbare bedrijven verkennen", description: "Verken op de publieke bedrijfsfiche andere rechtspersonen met overeenkomstige activiteit, omzetklasse, VTE-klasse of rechtsvorm, voor zover gegevens beschikbaar zijn. Dit bewijst geen commerciële geschiktheid." },
        ],
      },
    ],
  },
  fr: {
    metadataTitle: "Possibilités de BelgoBase | Rechercher, analyser et exporter",
    metadataDescription: "Découvrez 15 possibilités concrètes de BelgoBase pour la sélection d’entreprises, les listes de prospection, l’analyse, l’export Excel et la fiche publique gratuite.",
    eyebrow: "15 possibilités concrètes",
    title: "D’une question générale à une sélection d’entreprises exploitable",
    intro: "BelgoBase réunit la recherche, la sélection, l’analyse et l’export. Découvrez ce que vous pouvez faire dans l’espace de travail payant et quelles informations sont accessibles gratuitement dans la fiche publique.",
    workspaceLabel: "Espace de travail payant",
    workspaceTitle: "Construire et exploiter des sélections",
    workspaceDescription: "L’espace de travail est destiné aux sélections ciblées, à l’analyse, à l’assistance conversationnelle et à l’export Excel. Un compte BelgoBase actif est requis.",
    publicLabel: "Fiche publique gratuite",
    publicTitle: "Rechercher gratuitement une personne morale",
    publicDescription: "La fiche publique fonctionne sans compte pour une entreprise par recherche. Elle ne permet ni sélection ni export en masse.",
    demoCta: "Demander une démo",
    workspaceCta: "Ouvrir l’espace de travail",
    lookupCta: "Rechercher une entreprise gratuitement",
    useCasesTitle: "Partez de votre question concrète",
    useCasesIntro: "Découvrez comment ces possibilités se combinent dans quatre applications courantes.",
    useCaseLinkLabel: "Voir l’application",
    groups: [
      {
        title: "Rechercher et délimiter des entreprises",
        intro: "Construisez une sélection à partir des données officielles disponibles.",
        access: "workspace",
        items: [
          { title: "Rechercher des entreprises belges", description: "Recherchez des entreprises belges avec BelgoBase et constituez une sélection à partir des données d’entreprise disponibles." },
          { title: "Sélectionner par secteur et NACE-BEL", description: "Délimitez votre public cible au moyen des secteurs et des activités NACE-BEL enregistrées. Vérifiez si les entreprises trouvées correspondent à votre offre." },
          { title: "Sélectionner par région et code postal", description: "Recherchez des entreprises par région, commune ou code postal à partir des adresses BCE disponibles. Une adresse enregistrée ne décrit pas tous les lieux où une entreprise est active." },
          { title: "Sélectionner par taille d’entreprise", description: "Affinez votre sélection avec les données ETP disponibles. L’ETP mesure le volume de travail et ne correspond pas au nombre de personnes." },
          { title: "Filtrer par forme juridique et statut", description: "Utilisez les formes juridiques et statuts disponibles pour délimiter votre sélection. Consultez les données source de l’entreprise trouvée." },
        ],
      },
      {
        title: "De la sélection à une liste exploitable",
        intro: "Affinez votre cible, conservez le contexte et reprenez les données choisies dans votre propre travail.",
        access: "workspace",
        items: [
          { title: "Composer des listes de prospection B2B", description: "Composez dans BelgoBase une liste d’entreprises pour préparer votre prospection commerciale. Évaluez vous-même les entreprises pertinentes avant de les contacter." },
          { title: "Exporter des sélections vers Excel", description: "Exportez les entreprises choisies et les colonnes disponibles de votre sélection BelgoBase vers Excel pour les traiter dans votre propre travail." },
          { title: "Définir le public cible par la conversation", description: "Décrivez votre offre et votre connaissance des clients dans la conversation BelgoBase. L’assistant propose des critères et des entreprises ; vous contrôlez les hypothèses et la pertinence." },
          { title: "Affiner les sélections dans l’espace de travail", description: "Consultez les filtres utilisés et les entreprises trouvées dans l’espace de travail. Adaptez vos critères et utilisez l’historique de recherche pour affiner votre sélection." },
          { title: "Utiliser votre fichier clients comme point de départ", description: "Utilisez temporairement une liste clients Excel ou CSV comme contexte pour une proposition de cible. Vous évaluez les critères proposés ; il ne s’agit ni d’un CRM ni d’une connexion automatique garantie." },
        ],
      },
      {
        title: "Comprendre les entreprises et leurs chiffres",
        intro: "Consultez les données source disponibles et comparez les exercices sans compléter les valeurs manquantes.",
        access: "workspace",
        items: [
          { title: "Consulter les données d’entreprise", description: "Consultez les données de base BCE disponibles, comme le numéro d’entreprise, l’activité enregistrée et les caractéristiques juridiques." },
          { title: "Voir les chiffres financiers disponibles", description: "Consultez les chiffres clés BNB disponibles avec leur source et leur exercice. Toutes les entreprises ne publient pas les mêmes données ; les valeurs manquantes restent inconnues." },
          { title: "Comparer l’historique financier", description: "Comparez les exercices disponibles et visualisez les évolutions financières dans des graphiques. Tenez compte des années manquantes et des différences entre les chiffres publiés." },
        ],
      },
      {
        title: "Fiche publique gratuite",
        intro: "Recherchez une personne morale sans compte et explorez les informations disponibles.",
        access: "public",
        items: [
          { title: "Rechercher une entreprise", description: "Recherchez gratuitement une personne morale sur le site BelgoBase par nom ou numéro d’entreprise/de TVA. Consultez les données BCE et BNB disponibles sans compte ; cette voie ne permet pas l’export en masse." },
          { title: "Explorer des entreprises comparables", description: "Explorez dans la fiche publique d’autres personnes morales présentant une activité, une classe de chiffre d’affaires, une classe ETP ou une forme juridique similaire, selon les données disponibles. Cela ne prouve pas leur pertinence commerciale." },
        ],
      },
    ],
  },
  en: {
    metadataTitle: "BelgoBase capabilities | Search, analyse and export",
    metadataDescription: "Discover 15 practical BelgoBase capabilities for company selection, prospecting lists, analysis, Excel export and the free public company profile.",
    eyebrow: "15 practical capabilities",
    title: "From a broad business question to a usable company selection",
    intro: "BelgoBase brings search, selection, analysis and export together. See what you can do in the paid workspace and which information you can access for free in the public company profile.",
    workspaceLabel: "Paid workspace",
    workspaceTitle: "Build and work with selections",
    workspaceDescription: "The workspace is designed for targeted company selections, analysis, conversation support and Excel export. An active BelgoBase account is required.",
    publicLabel: "Free public profile",
    publicTitle: "Look up one legal entity for free",
    publicDescription: "The public profile works without an account for one company per search. It does not provide bulk selection or bulk export.",
    demoCta: "Request a demo",
    workspaceCta: "Open the workspace",
    lookupCta: "Look up one company for free",
    useCasesTitle: "Start with your specific question",
    useCasesIntro: "See how the capabilities come together in four common use cases.",
    useCaseLinkLabel: "View the use case",
    groups: [
      {
        title: "Search and narrow down companies",
        intro: "Build a selection using the available official company data.",
        access: "workspace",
        items: [
          { title: "Search Belgian companies", description: "Search Belgian enterprises with BelgoBase and build a selection based on the available company data." },
          { title: "Select by sector and NACE-BEL", description: "Narrow down your target group using sectors and registered NACE-BEL activities. Check whether the companies found fit your offer." },
          { title: "Select by region and postcode", description: "Search for companies by region, municipality or postcode using the available CBE address data. A registered address does not describe every place where a company operates." },
          { title: "Select by company size", description: "Refine your company selection with available FTE data. FTE measures labour volume and is not the same as the number of people." },
          { title: "Filter by legal form and status", description: "Use available legal forms and legal statuses to narrow down your company selection. Review the source data for the company found." },
        ],
      },
      {
        title: "Turn a selection into a working list",
        intro: "Refine your target group, retain the context and take the selected data into your own work.",
        access: "workspace",
        items: [
          { title: "Build B2B prospecting lists", description: "Build a company list in BelgoBase to prepare your commercial outreach. Assess which companies fit before following them up." },
          { title: "Export selections to Excel", description: "Export selected companies and available columns from your BelgoBase selection to Excel for further use in your own work." },
          { title: "Define your target group through conversation", description: "Describe your offer and customer knowledge in the BelgoBase conversation. The assistant proposes selection criteria and companies; you check the assumptions and fit." },
          { title: "Refine selections in the workspace", description: "Review the filters used and companies found in the workspace. Adjust your criteria and use the search history to refine your selection further." },
          { title: "Use your customer file as a starting point", description: "Temporarily use an Excel or CSV customer list as context for a target group proposal. You assess the proposed criteria; this is not a CRM or a guaranteed automatic connection." },
        ],
      },
      {
        title: "Understand companies and figures",
        intro: "Review available source data and compare financial years without filling in missing values.",
        access: "workspace",
        items: [
          { title: "Consult company information", description: "View the available CBE basic data for an enterprise, such as its company number, registered activity and legal characteristics." },
          { title: "View available financial figures", description: "Review available NBB key figures with their source and financial year. Not every company publishes the same data; missing values remain unknown." },
          { title: "Compare financial history", description: "Compare available financial years and view financial developments in charts. Allow for missing years and differences in the published figures." },
        ],
      },
      {
        title: "Free public company profile",
        intro: "Look up one legal entity without an account and explore the available information.",
        access: "public",
        items: [
          { title: "Look up one company", description: "Look up one legal entity for free on the BelgoBase website by name or company/VAT number. View available CBE and NBB data without an account; this route does not provide bulk export." },
          { title: "Explore similar companies", description: "Explore other legal entities in the public company profile with a similar activity, turnover band, FTE band or legal form, where data is available. This does not prove commercial suitability." },
        ],
      },
    ],
  },
};

