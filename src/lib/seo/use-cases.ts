import type { Locale } from "@/i18n/config";

export const useCaseSlugs = ["bedrijven-zoeken", "prospectielijsten", "klantenbestand-analyseren", "bedrijfsanalyse"] as const;
export type UseCaseSlug = typeof useCaseSlugs[number];
type UseCase = { title: string; heading?: string; description: string; question: string; intro: string; steps: [string, string][]; result: string; boundary: string; criteria?: [string, string][]; primaryCta?: string; secondaryCta?: string; ctaMicrocopy?: string };

const nl: Record<UseCaseSlug, UseCase> = {
  "bedrijven-zoeken": {
    heading: "Belgische bedrijven zoeken voor uw volgende prospectielijst.",
    title: "Belgische bedrijven zoeken op sector, regio en grootte",
    description: "Zoek in de Belgische bedrijvendatabase op sector, NACE-BEL, regio en beschikbare VTE. Controleer uw selectie en stel een bedrijvenlijst samen voor Excel.",
    question: "Ik lever aan bedrijven in de regio Mechelen. Help me een doelgroep kiezen die bij mijn aanbod past.",
    intro: "Selecteer op activiteit, regio en beschikbare bedrijfsgegevens. Controleer uw doelgroep en kies zelf welke bedrijven en kolommen u naar Excel exporteert.",
    steps: [["Bespreek uw doelgroep", "Vertel welke Belgische bedrijven passen bij uw aanbod en welke regio u wilt bereiken."], ["Controleer de selectie", "Bekijk de activiteiten, regio en beschikbare bedrijfsgegevens voordat u bedrijven kiest."], ["Kies bedrijven en Excel-kolommen", "Selecteer zelf welke bedrijven en gegevens u naar Excel exporteert."]],
    primaryCta: "Vraag een demo aan met uw doelgroep",
    secondaryCta: "Bekijk de productvideo",
    ctaMicrocopy: "Na de aanvraag nemen we contact op. De video kunt u meteen bekijken.",
    criteria: [["Sector en NACE-BEL-activiteit", "Selecteer activiteiten die bij uw aanbod passen. Een activiteitencode beschrijft een geregistreerde activiteit; bekijk ook het bedrijf zelf voordat u het benadert."], ["Regio, gemeente en postcode", "Baken uw werkgebied af met Belgische locatiecriteria. De selectie volgt het beschikbare KBO-bedrijfsadres; dat is niet noodzakelijk iedere locatie waar een onderneming actief is."], ["Personeel en financiële gegevens", "Combineer uw doelgroep met beschikbare VTE- en financiële gegevens. VTE staat voor voltijdsequivalenten en is niet hetzelfde als het aantal personen. Niet ieder bedrijf publiceert omzet of een volledige jaarrekening."], ["Rechtsvorm en rechtstoestand", "Maak onderscheid tussen de rechtsvorm van een onderneming en haar juridische toestand. Gebruik de beschikbare opname- en uitsluitingsfilters om uw selectie verder te verfijnen."]],
    result: "Een gerichte Belgische bedrijvenlijst met de velden die u zelf hebt gekozen. U kunt de selectie verder onderzoeken en gebruiken voor uw commerciële voorbereiding.",
    boundary: "Een bedrijf dat aan uw criteria voldoet, heeft niet automatisch interesse in uw aanbod. De beschikbaarheid van contactgegevens en financiële cijfers verschilt per onderneming.",
  },
  prospectielijsten: {
    heading: "Wat doet uw belteam als de lijst alweer op is?",
    title: "Een Belgische prospectielijst maken en exporteren naar Excel",
    description: "Stel een prospectlijst van Belgische bedrijven samen voor B2B-prospectie. Verfijn sector, regio en omvang en exporteer gekozen bedrijven en kolommen naar Excel.",
    question: "Ik lever fruit op het werk. Zoek bedrijven rond Mechelen met minstens 20 medewerkers.",
    intro: "Uw bellers zijn klaar. De volgende lijst niet. Of ze bellen dezelfde bedrijven terug, zonder te weten waarom die er opnieuw op staan. Een prospectielijst maken begint bij de doelgroep voor uw B2B-prospectie: welke sector, regio en omvang passen bij uw aanbod? Controleer de Belgische bedrijven in uw selectie en stel een prospectlijst samen met de beschikbare kolommen die u naar Excel wilt exporteren.",
    steps: [["“Iedereen” is geen bruikbare doelgroep", "Bespreek welke regio, activiteit en omvang passen bij uw dienstverlening. U beoordeelt en bevestigt het voorstel."], ["Volume verbergt een verkeerde match", "Bekijk de bedrijven voordat u de lijst gebruikt. Verfijn de criteria in het gesprek of rechtstreeks in Werkruimte."], ["Uw team moet niet opnieuw alle gegevens uitzoeken", "Onderzoek beschikbare contactinformatie en exporteer de bedrijfsvelden die uw volgende belronde nodig heeft."]],
    result: "Een herbruikbare prospectielijst van Belgische bedrijven, met uw gekozen gegevens in Excel, voor de voorbereiding van uw volgende prospectieronde.",
    boundary: "Een passend bedrijf is nog geen geïnteresseerde klant. Contactgegevens zijn niet voor elk bedrijf beschikbaar. BelgoBase garandeert geen afspraken of verkoopresultaten.",
  },
  "klantenbestand-analyseren": {
    heading: "Hoeveel klantkennis ligt ongebruikt in uw oude Excel-lijsten?",
    title: "Uw klantenbestand analyseren voor gerichte B2B-prospectie",
    description: "Gebruik uw Excel- of CSV-klantenbestand als context voor B2B-prospectie. Controleer de voorgestelde doelgroep en zoek Belgische bedrijven op bevestigde criteria.",
    question: "Dit zijn mijn klanten. Help me bepalen welke soort bedrijven ik verder moet benaderen.",
    intro: "Uw team heeft bedrijven gebeld, notities gemaakt en klanten gewonnen. Toch begint het zoeken naar de volgende doelgroep vaak bij nul. Welk klant zou u vandaag niet meer aannemen als u opnieuw mocht kiezen? Gebruik die ervaring als context, in plaats van enkel nóg een lijst te kopen.",
    steps: [["De lijst ligt er, de kennis wordt niet gebruikt", "Voeg een Excel- of CSV-lijst toe en controleer de kolommen. Geef aan of de lijst klanten of prospects bevat."], ["Niet iedere gewonnen klant wilt u opnieuw", "Bespreek welke klanten en opdrachten goed passen en welke niet. Controleer de doelgroep die de assistent voorstelt."], ["Een nieuwe lijst herhaalt anders dezelfde keuzes", "Zoek Belgische bedrijven op uw bevestigde criteria. Beoordeel de selectie voordat u de gegevens exporteert."]],
    result: "Een expliciete doelgroep en een nieuwe selectie die aansluit bij de context die u hebt meegegeven.",
    boundary: "De tijdelijke upload ondersteunt Excel en CSV tot 5.000 rijen en 4 MB. Gebruik alleen gegevens die u hiervoor mag verwerken. Een upload is geen automatische CRM-koppeling of garantie op identieke klanten.",
  },
  bedrijfsanalyse: {
    heading: "Hoeveel voorbereiding doet u voor een bedrijf dat niet bij uw aanbod past?",
    title: "Belgische bedrijfsinformatie en financiële gegevens bekijken",
    description: "Bekijk KBO-bedrijfsinformatie en beschikbare financiële NBB-gegevens. Controleer VTE, boekjaar en ontbrekende cijfers voordat u een bedrijf prioriteit geeft.",
    question: "Welke bedrijven in mijn selectie passen qua omvang en financiële cijfers bij mijn aanbod?",
    intro: "Uw verkoper heeft het bedrijf opgezocht, een afspraak voorbereid en tijd vrijgemaakt. Pas dan blijkt dat het te klein is of niet past bij de dienstverlening. Bekijk daarom KBO-bedrijfsinformatie en beschikbare financiële NBB-gegevens naast elkaar. Controleer bij cijfers zoals omzet en VTE het boekjaar en ontbrekende waarden voordat u bedrijven vergelijkt of een prospect prioriteit geeft.",
    steps: [["Een naam zegt te weinig", "Open een onderneming vanuit uw selectie of zoek op naam of ondernemingsnummer."], ["De context ontbreekt in uw belbestand", "Bekijk beschikbare activiteit, VTE en financiële historiek. Onbekende cijfers zijn geen nul en bewijzen geen toekomstig betaalgedrag."], ["Uw prioriteiten zijn anders vooral een gok", "Gebruik de beschikbare criteria om uw selectie te verfijnen en exporteer de informatie die uw team nodig heeft."]],
    result: "Een beter onderbouwde selectie, met bedrijfsinformatie en beschikbare cijfers naast elkaar.",
    boundary: "Niet elke onderneming publiceert alle cijfers. Een ontbrekende waarde is geen nul. BelgoBase biedt geen garantie over kredietwaardigheid of toekomstig betaalgedrag.",
  },
};
const en: Record<UseCaseSlug, UseCase> = {
  "bedrijven-zoeken": {
    heading: "Find Belgian companies for your next prospect list.",
    title: "Find Belgian companies by industry, region and size",
    description: "Search the Belgian company database by industry, NACE-BEL, region and available FTE data. Review your selection and build a company list for Excel.",
    question: "I supply businesses around Mechelen. Help me choose a target market that fits my offer.",
    intro: "Select by activity, region and available company data. Review your target market and choose which companies and columns to export to Excel.",
    steps: [["Discuss your target market", "Describe the Belgian companies that fit your offer and the region you want to reach."], ["Review the selection", "Check activities, region and available company data before choosing companies."], ["Choose companies and Excel columns", "Select which companies and information to export to Excel."]],
    primaryCta: "Request a demo with your target market",
    secondaryCta: "Watch the product video",
    ctaMicrocopy: "We will contact you after your request. You can watch the video straight away.",
    criteria: [["Industry and NACE-BEL activity", "Select activities that fit your offer. An activity code describes a registered activity; review the business itself before approaching it."], ["Region, municipality and postcode", "Define your service area using Belgian location criteria. The selection follows the available KBO company address, which does not necessarily cover every location where a business operates."], ["Staff and financial information", "Combine your target criteria with available FTE and financial data. FTE means full-time equivalents, not headcount. Not every company publishes revenue or a complete set of annual accounts."], ["Legal form and legal status", "Distinguish a company's legal form from its legal status. Use the available inclusion and exclusion filters to refine your selection."]],
    result: "A focused Belgian company list with the fields you chose. Continue researching your selection and use it to prepare your sales work.",
    boundary: "Matching your criteria does not mean a company is interested in your offer. Contact details and financial figures are not available for every company.",
  },
  prospectielijsten: {
    heading: "What does your calling team do when the list runs out again?",
    title: "Build a Belgian prospect list and export it to Excel",
    description: "Build a Belgian company list for B2B prospecting. Refine industry, region and size, then export your chosen companies and columns to Excel.",
    question: "I deliver fruit to workplaces. Find companies around Mechelen with at least 20 employees.",
    intro: "Your callers are ready. The next list is not. Or they revisit the same companies without knowing why they are back. Building a prospect list starts with your B2B target market: which industry, region and size fit your offer? Review the Belgian companies in your selection and choose the available columns to export to Excel.",
    steps: [["“Everyone” is not a useful target market", "Discuss location, activity and size. Review and confirm the proposal."], ["Volume hides the wrong fit", "Inspect the companies before using the list. Refine criteria in Conversation or Workspace."], ["Your team should not have to research every field again", "Research available contact information and export the fields needed for your next calling campaign."]],
    result: "A reusable prospect list of Belgian companies, with your chosen fields in Excel, to prepare your next prospecting campaign.",
    boundary: "A matching company is not necessarily an interested buyer. Contact details are not available for every company. BelgoBase does not guarantee appointments or sales.",
  },
  "klantenbestand-analyseren": {
    heading: "How much customer knowledge sits unused in your old Excel lists?",
    title: "Analyse your customer list for focused B2B prospecting",
    description: "Use your Excel or CSV customer list as context for B2B prospecting. Review the proposed target market and find Belgian companies using confirmed criteria.",
    question: "These are my customers. Help me decide which kinds of companies to approach next.",
    intro: "Your team has called companies, made notes and won customers. Yet researching the next target market often starts from scratch. Which customer would you decline if you could choose again today? Use that experience as context instead of simply buying another list.",
    steps: [["The list is there; the knowledge is unused", "Add an Excel or CSV list, review the columns and identify it as customers or prospects."], ["You would not want every won customer again", "Discuss which customers and projects fit and which do not. Review the assistant’s target proposal."], ["The next list otherwise repeats the same choices", "Find Belgian companies using confirmed criteria. Review the selection before exporting."]],
    result: "Explicit target criteria and a new selection informed by the context you provided.",
    boundary: "Temporary uploads support Excel and CSV up to 5,000 rows and 4 MB. Only upload data you are entitled to process. Uploading is not an automatic CRM integration or a guarantee of identical customers.",
  },
  bedrijfsanalyse: {
    heading: "How much preparation goes into a company that does not fit your offer?",
    title: "View Belgian company information and financial data",
    description: "Review CBE company information and available NBB financial data. Check FTE, financial year and missing figures before prioritising a company.",
    question: "Which companies in my selection fit my offer in terms of size and financial figures?",
    intro: "Your salesperson researched the company, prepared a meeting and set aside time. Only then does it turn out to be too small or unsuitable. Review CBE company information alongside available NBB financial data. For figures such as revenue and FTE, check the financial year and missing values before comparing companies or prioritising a prospect.",
    steps: [["A name tells you too little", "Open a company from your selection or search by name or enterprise number."], ["The context is missing from your calling list", "Review available activity, FTE and financial history. Unknown figures are not zero and do not prove future payment behaviour."], ["Your priorities otherwise rely mostly on guesswork", "Use available criteria to refine the selection and export information your team needs."]],
    result: "A more informed selection, with company information and available financial figures together.",
    boundary: "Not every company publishes every figure. Missing does not mean zero. BelgoBase does not guarantee creditworthiness or future payment behaviour.",
  },
};
const fr: Record<UseCaseSlug, UseCase> = {
  "bedrijven-zoeken": {
    "heading": "Trouvez des entreprises belges pour votre prochaine liste de prospection.",
    "title": "Trouver des entreprises belges par secteur, région et taille",
    "description": "Cherchez des entreprises belges par secteur, NACE-BEL, région et ETP disponibles. Vérifiez la sélection et constituez une liste à exporter vers Excel.",
    "question": "Je fournis des entreprises autour de Malines. Aidez-moi à choisir une cible adaptée à mon offre.",
    "intro": "Sélectionnez par activité, région et données d’entreprise disponibles. Vérifiez votre cible et choisissez les entreprises et colonnes à exporter vers Excel.",
    "primaryCta": "Demandez une démo avec votre cible",
    "secondaryCta": "Voir la vidéo du produit",
    "ctaMicrocopy": "Nous vous contacterons après votre demande. Vous pouvez regarder la vidéo dès maintenant.",
    "steps": [
      ["Discutez de votre cible", "Décrivez les entreprises belges adaptées à votre offre et la région que vous souhaitez atteindre."],
      ["Vérifiez la sélection", "Examinez les activités, la région et les données disponibles avant de choisir les entreprises."],
      ["Choisissez les entreprises et colonnes Excel", "Sélectionnez vous-même les entreprises et les informations à exporter vers Excel."]
    ],
    "criteria": [
      [
        "Secteur et activité NACE-BEL",
        "Sélectionnez les activités adaptées à votre offre. Un code décrit une activité enregistrée ; examinez également l’entreprise avant de la contacter."
      ],
      [
        "Région, commune et code postal",
        "Définissez votre zone avec les critères de localisation belges. La sélection suit l’adresse disponible à la BCE, qui ne couvre pas nécessairement tous les lieux d’activité."
      ],
      [
        "Personnel et données financières",
        "Combinez vos critères avec les ETP et les données financières disponibles. ETP signifie équivalents temps plein, et non nombre de personnes. Toutes les entreprises ne publient pas leur chiffre d’affaires ou des comptes annuels complets."
      ],
      [
        "Forme juridique et situation juridique",
        "Distinguez la forme juridique de la situation juridique de l’entreprise. Utilisez les filtres d’inclusion et d’exclusion disponibles pour affiner la sélection."
      ]
    ],
    "result": "Une liste ciblée d’entreprises belges avec les champs choisis. Poursuivez la recherche et utilisez la sélection pour préparer votre travail commercial.",
    "boundary": "Correspondre à vos critères ne signifie pas être intéressé par votre offre. La disponibilité des coordonnées et des chiffres varie selon l’entreprise."
  },
  "prospectielijsten": {
    "heading": "Que fait votre équipe d’appel quand la liste est à nouveau épuisée ?",
    "title": "Constituer une liste de prospects belges et l’exporter vers Excel",
    "description": "Constituez une liste d’entreprises belges pour la prospection B2B. Affinez le secteur, la région et la taille, puis exportez les champs choisis vers Excel.",
    "question": "Je livre des fruits au travail. Trouvez des entreprises autour de Malines avec au moins 20 employés.",
    "intro": "Vos équipes sont prêtes. La prochaine liste ne l’est pas. Ou elles rappellent les mêmes entreprises sans savoir pourquoi. Constituer une liste de prospects commence par votre cible B2B : quels secteurs, régions et tailles correspondent à votre offre ? Examinez les entreprises belges de votre sélection et choisissez les colonnes disponibles à exporter vers Excel.",
    "steps": [
      [
        "« Tout le monde » n’est pas une cible utile",
        "Discutez de la localisation, de l’activité et de la taille. Examinez et confirmez la proposition."
      ],
      [
        "Le volume masque une mauvaise correspondance",
        "Examinez les entreprises avant d’utiliser la liste. Affinez les critères dans Conversation ou Espace de travail."
      ],
      [
        "Votre équipe ne devrait pas devoir rechercher chaque champ à nouveau",
        "Recherchez les coordonnées disponibles et exportez les champs utiles à votre prochaine campagne."
      ]
    ],
    "result": "Une liste réutilisable de prospects parmi les entreprises belges, avec les champs choisis dans Excel, pour préparer votre prochaine campagne.",
    "boundary": "Une entreprise adaptée n’est pas nécessairement intéressée. Les coordonnées ne sont pas disponibles pour chaque entreprise. BelgoBase ne garantit ni rendez-vous ni ventes."
  },
  "klantenbestand-analyseren": {
    "heading": "Combien de connaissances clients restent inutilisées dans vos anciennes listes Excel ?",
    "title": "Analyser votre fichier clients pour une prospection B2B ciblée",
    "description": "Utilisez votre fichier clients Excel ou CSV comme contexte pour la prospection B2B. Vérifiez la cible proposée et cherchez des entreprises belges selon les critères confirmés.",
    "question": "Voici mes clients. Aidez-moi à décider quels types d’entreprises contacter ensuite.",
    "intro": "Votre équipe a appelé, pris des notes et gagné des clients. Pourtant la recherche de la prochaine cible repart souvent de zéro. Quel client refuseriez-vous si vous pouviez choisir à nouveau ? Utilisez cette expérience comme contexte plutôt que d’acheter simplement une autre liste.",
    "steps": [
      [
        "La liste existe, la connaissance reste inutilisée",
        "Ajoutez une liste Excel ou CSV, vérifiez les colonnes et indiquez s’il s’agit de clients ou de prospects."
      ],
      [
        "Vous ne voudriez pas regagner chaque client",
        "Discutez des clients et des missions adaptés ou non. Examinez la cible proposée par l’assistant."
      ],
      [
        "La prochaine liste répète sinon les mêmes choix",
        "Trouvez des entreprises belges à partir des critères confirmés. Examinez la sélection avant l’export."
      ]
    ],
    "result": "Une cible explicite et une nouvelle sélection éclairée par le contexte fourni.",
    "boundary": "L’import temporaire accepte Excel et CSV jusqu’à 5 000 lignes et 4 Mo. Importez uniquement des données que vous avez le droit de traiter. Ce n’est ni une intégration CRM automatique ni une garantie de clients identiques."
  },
  "bedrijfsanalyse": {
    "heading": "Combien de préparation consacrez-vous à une entreprise inadaptée à votre offre ?",
    "title": "Consulter les informations et données financières d’entreprises belges",
    "description": "Consultez les informations de la BCE et les données financières disponibles de la BNB. Vérifiez les ETP, l’exercice et les valeurs absentes avant de fixer vos priorités.",
    "question": "Quelles entreprises de ma sélection correspondent à mon offre par leur taille et leurs chiffres financiers ?",
    "intro": "Votre commercial a recherché l’entreprise, préparé un rendez-vous et réservé du temps. Elle s’avère ensuite trop petite ou inadaptée. Examinez les informations de la BCE avec les données financières disponibles de la BNB. Pour les chiffres comme le chiffre d’affaires et les ETP, vérifiez l’exercice et les valeurs absentes avant de comparer des entreprises ou de fixer vos priorités.",
    "steps": [
      [
        "Un nom dit trop peu",
        "Ouvrez une entreprise depuis votre sélection ou cherchez par nom ou numéro d’entreprise."
      ],
      [
        "Le contexte manque dans la liste d’appel",
        "Examinez l’activité, les ETP et l’historique financier disponibles. Un chiffre inconnu n’est pas zéro et ne prouve pas un comportement de paiement futur."
      ],
      [
        "Vos priorités reposent sinon surtout sur des suppositions",
        "Affinez la sélection avec les critères disponibles et exportez les informations utiles à votre équipe."
      ]
    ],
    "result": "Une sélection mieux étayée, réunissant informations d’entreprise et chiffres disponibles.",
    "boundary": "Toutes les entreprises ne publient pas chaque chiffre. Une valeur absente ne signifie pas zéro. BelgoBase ne garantit ni solvabilité ni comportement de paiement futur."
  }
};
export function getUseCase(locale: Locale, slug: UseCaseSlug): UseCase { return { nl, en, fr }[locale][slug]; }
