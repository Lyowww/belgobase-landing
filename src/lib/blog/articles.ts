import type { Locale } from "@/i18n/config";

export type BlogSection = {
  heading: string;
  paragraphs: readonly string[];
  points?: readonly string[];
};

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  readingTime: string;
  publishedAt: string;
  author: "BelgoBase";
  intro: readonly string[];
  sections: readonly BlogSection[];
  relatedLinks: readonly {
    href: string;
    label: string;
  }[];
};

export const blogArticles = [
  {
    slug: "prospectielijst-belgische-bedrijven-maken",
    title: "Een prospectielijst van Belgische bedrijven maken: van doelgroep naar bruikbare selectie",
    description:
      "Een praktische aanpak om uw doelgroep om te zetten in een controleerbare prospectielijst van Belgische bedrijven, met aandacht voor NACE-BEL, regio, grootte en financiële dekking.",
    excerpt:
      "Een goede prospectielijst begint niet met zoveel mogelijk rijen, maar met duidelijke keuzes over niche, activiteit, regio, grootte en beschikbare cijfers.",
    readingTime: "8 min. lezen",
    publishedAt: "2026-10-08",
    author: "BelgoBase",
    intro: [
      "Een prospectielijst is pas bruikbaar wanneer u kunt uitleggen waarom elk bedrijf erin staat. Een lange Excel met ondernemingsnamen voelt productief, maar zonder duidelijke doelgroep bevat ze meestal te veel bedrijven die uw aanbod niet nodig hebben, buiten uw werkgebied liggen of niet bij uw verkoopaanpak passen.",
      "De praktische route loopt daarom van een scherpe doelgroep naar een voorlopige selectie, daarna naar controle en pas op het einde naar export. Zo blijft de lijst een werkbaar vertrekpunt voor prospectie in plaats van een verzameling rijen die uw belteam zelf nog moet uitzoeken.",
    ],
    sections: [
      {
        heading: "1. Begin bij het probleem dat u oplost",
        paragraphs: [
          "Omschrijf eerst wie werkelijk voordeel heeft van uw aanbod. ‘Kmo’s in België’ is zelden precies genoeg. ‘Technische installatiebedrijven in Antwerpen en Limburg met een eigen ploeg’ geeft al veel meer richting. Noteer ook wie u bewust uitsluit, bijvoorbeeld starters zonder operationele historiek, holdings zonder zichtbare activiteit of bedrijven buiten uw levergebied.",
          "Denk in herkenbare kenmerken die later controleerbaar zijn. Een niche kan aansluiten bij een activiteit, maar ook bij grootte, rechtsvorm, vestigingsplaats of de beschikbaarheid van financiële gegevens. Niet ieder commercieel kenmerk bestaat als officieel databronveld. Een goede selectie maakt dat verschil zichtbaar in plaats van een vermoeden als zekerheid te presenteren.",
        ],
      },
      {
        heading: "2. Vertaal uw niche naar sector en NACE-BEL",
        paragraphs: [
          "Belgische ondernemingen worden met NACE-BEL-codes aan economische activiteiten gekoppeld. Die codes zijn nuttig om een sector af te bakenen, maar één bedrijf kan meerdere officiële activiteiten hebben. Alleen op één brede code zoeken kan daarom te veel opleveren, terwijl één heel specifieke code relevante nevenactiviteiten kan missen.",
          "Werk van breed naar precies. Bekijk eerst welke activiteiten werkelijk in uw eerste resultaten voorkomen. Voeg daarna passende codes of activiteitswoorden toe en sluit aantoonbaar verkeerde groepen uit. Behandel een NACE-BEL-code als een brongegeven over geregistreerde activiteit, niet als bewijs dat het bedrijf vandaag precies uw gewenste dienst uitvoert of koopbereid is.",
        ],
        points: [
          "Kies één of meer activiteiten die de doelgroep inhoudelijk beschrijven.",
          "Controleer een aantal bedrijfsfiches voordat u een code definitief gebruikt.",
          "Bewaar uitsluitingen, zodat dezelfde verkeerde subgroep niet terugkeert.",
        ],
      },
      {
        heading: "3. Maak regio concreet",
        paragraphs: [
          "‘In Vlaanderen’ kan voor een eerste verkenning volstaan, maar een werkbare route vraagt vaak om provincies, gemeenten of postcodes. Gebruik het niveau dat bij uw verkoopproces past. Een lokale dienstverlener kan rond één postcode werken; een distributeur kan meerdere provincies combineren. Let erop of u de maatschappelijke zetel of een relevante vestiging bedoelt.",
          "Controleer enkele adressen in de selectie. Officiële brongegevens kunnen veranderen en niet elk historisch of ontbrekend adres kan verantwoord worden aangevuld. Een lege locatie is geen reden om zelf een gemeente te verzinnen. Leg zulke records apart als de regio doorslaggevend is.",
        ],
      },
      {
        heading: "4. Bepaal grootte zonder schijnprecisie",
        paragraphs: [
          "Grootte kan slaan op werknemers, omzet, balanstotaal of een combinatie. Kies de maatstaf die iets zegt over uw aanbod. Voor personeelssoftware kan het aantal voltijdse equivalenten relevant zijn; voor financiering of advies kunnen beschikbare jaarrekeningcijfers meer zeggen. Een drempel is een selectieregel, geen kwaliteitsbeoordeling.",
          "Financiële dekking verschilt per onderneming en boekjaar. Niet elk bedrijf publiceert dezelfde posten en ontbrekende omzet betekent niet dat de omzet nul is. Noteer daarom welke waarde, welk boekjaar en welke bronbasis u gebruikt. Als recente cijfers noodzakelijk zijn, neem dan ook een regel op voor ontbrekende of oudere rapportering in plaats van die bedrijven stilzwijgend te mengen met volledig gedekte dossiers.",
        ],
      },
      {
        heading: "5. Werk met zichtbare voorlopige bedrijven",
        paragraphs: [
          "Een gesprek in gewone taal kan helpen om uw vraag om te zetten in uitvoerbare criteria. In BelgoBase maakt zo’n gesprek een voorlopige doelgroep en zoekt het meteen echte bedrijven uit de beschikbare databronnen. De gebruikte filters en gevonden bedrijven blijven zichtbaar. Daardoor kunt u beoordelen of de vertaling van uw vraag klopt.",
          "Beantwoord vervolgvragen inhoudelijk: is een bepaalde activiteit te breed, moet een regio weg of ligt de ondergrens te laag? Na zo’n verfijning wordt de selectie opnieuw opgebouwd. Onbekende regio’s of commerciële geschiktheid blijven aannames. Het gesprek is dus een snellere manier om te onderzoeken, geen automatische garantie dat ieder resultaat een goede prospect is.",
        ],
      },
      {
        heading: "6. Controleer de lijst vóór de export",
        paragraphs: [
          "Bekijk niet alleen het totaal. Open voorbeelden bovenaan, in het midden en onderaan de selectie. Controleer ondernemingsnummer, naam, activiteit, adres, groottecriterium en gebruikte financiële periode. Let ook op opvallende clusters: onverwacht veel holdings, slapende activiteiten of bedrijven uit één gemeente wijzen vaak op een te brede of verkeerd geïnterpreteerde regel.",
          "Maak uw controle herhaalbaar. Schrijf kort op waarom u een filter wijzigde en welke randgevallen apart moeten worden bekeken. Dat voorkomt dat een collega volgende week dezelfde brede zoekopdracht opnieuw uitvoert. Het helpt ook om later te onderscheiden tussen een veranderde doelgroep en veranderde brongegevens.",
        ],
        points: [
          "Zijn de geselecteerde activiteiten inhoudelijk relevant?",
          "Klopt de geografische betekenis voor uw route of levergebied?",
          "Zijn ontbrekende cijfers apart herkenbaar van echte nulwaarden?",
          "Kunt u voor een willekeurige rij uitleggen waarom die geselecteerd is?",
        ],
      },
      {
        heading: "7. Exporteer pas wanneer de selectie klopt",
        paragraphs: [
          "Een export is het bewuste eindpunt van de selectie, niet iets dat ongemerkt tijdens het gesprek gebeurt. Kies de kolommen die uw volgende stap nodig heeft en exporteer de bevestigde lijst naar Excel. Contactonderzoek of andere betaalde verrijking hoort evenmin automatisch te starten: bepaal eerst voor welke gecontroleerde bedrijven dat zinvol is.",
          "Bewaar naast het bestand ook de kern van uw zoekbrief: doelgroep, sectorcodes, regio, grootte, financiële periode en uitsluitingen. Dan kunt u de selectie later gericht vernieuwen zonder het denkwerk opnieuw te doen. De beste prospectielijst is niet de grootste, maar degene waarvan uw team de keuzes begrijpt en de onzekerheden kan zien.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/nl/prospectielijsten", label: "Bekijk de toepassingspagina over prospectielijsten" },
      { href: "/nl/bedrijven-zoeken", label: "Lees hoe u Belgische bedrijven zoekt en selecteert" },
    ],
  },
  {
    slug: "dubbele-bedrijven-excel-belteam",
    title: "Dubbele bedrijven in Excel: waarom uw belteam telkens opnieuw begint",
    description:
      "Waarom dubbele bedrijven, losse notities en onzekere telefoonnummers prospectiewerk vertragen, en hoe u Excelbestanden samenbrengt zonder bruikbare historie weg te gooien.",
    excerpt:
      "Dubbele rijen zijn zelden alleen een Excelprobleem. Ze verspreiden belnotities, verbergen conflicten en laten collega’s hetzelfde bedrijf opnieuw voorbereiden.",
    readingTime: "8 min. lezen",
    publishedAt: "2026-10-08",
    author: "BelgoBase",
    intro: [
      "Een bedrijf staat in lijst A met een telefoonnummer, in lijst B met een opmerking en in lijst C met een andere schrijfwijze. Voor Excel zijn dat drie rijen. Voor uw belteam is het één organisatie met een versnipperd verhaal. Wie alleen op ‘duplicaten verwijderen’ klikt, kan precies de informatie wissen die voorkomt dat iemand opnieuw van nul begint.",
      "Een bruikbare opschoning brengt daarom bronrijen samen, bewaart notities en maakt conflicten zichtbaar. Het doel is niet één schijnbaar perfecte rij, maar één controleerbaar bedrijfsbeeld waarmee een collega de volgende stap kan kiezen.",
    ],
    sections: [
      {
        heading: "1. Waarom dubbele rijen blijven terugkomen",
        paragraphs: [
          "Prospectielijsten ontstaan op verschillende momenten en voor verschillende campagnes. Bedrijfsnamen veranderen van schrijfwijze, adressen worden verplaatst en telefoonnummers krijgen spaties of landcodes. Een export uit een databron ziet er daardoor anders uit dan een handmatig bijgehouden bellijst, ook wanneer beide naar dezelfde onderneming verwijzen.",
          "Daar komt menselijke historie bij. De ene collega schrijft ‘terugbellen in november’, de andere noteert een naam van een gesprekspartner en een derde markeert de rij met een kleur. Wanneer bestanden los blijven bestaan, ziet niemand het volledige verhaal. De volgende campagne koopt of verzamelt dezelfde bedrijfsdata opnieuw en herhaalt vervolgens een deel van het voorbereidende werk.",
        ],
      },
      {
        heading: "2. Gebruik het ondernemingsnummer als sterkste sleutel",
        paragraphs: [
          "Voor Belgische ondernemingen is het ondernemingsnummer meestal de betrouwbaarste basis om records samen te brengen. Normaliseer eerst punten, spaties en een eventuele landprefix, en controleer daarna of de waarde een geldig formaat heeft. Voeg rijen met hetzelfde gecontroleerde ondernemingsnummer samen zonder hun herkomst te verbergen.",
          "Een ontbrekend ondernemingsnummer vraagt om voorzichtigheid. Een bedrijfsnaam en postcode kunnen een kandidaat-match opleveren, maar zijn geen hard bewijs. Telefoonnummers zijn nog riskanter: groepsnummers, callcenters en hergebruikte nummers kunnen bij meerdere entiteiten voorkomen. Gebruik telefoon daarom alleen als voorzichtige aanwijzing en stuur twijfelgevallen naar ‘nakijken’ in plaats van ze automatisch te versmelten.",
        ],
        points: [
          "Sterk: hetzelfde gecontroleerde ondernemingsnummer.",
          "Aanwijzing: vergelijkbare naam met passend adres of postcode.",
          "Voorzichtig: hetzelfde telefoonnummer zonder andere bevestiging.",
        ],
      },
      {
        heading: "3. Bewaar bronrijen, notities en conflicten",
        paragraphs: [
          "Opschonen betekent niet dat de oudste rij verdwijnt. Bewaar per samengebracht bedrijf uit welke bestanden en rijen de gegevens kwamen. Voeg notities samen zonder hun formulering stil te corrigeren. Wanneer twee bronnen verschillende telefoonnummers, adressen of contactpersonen geven, markeer dat verschil als conflict. Een mens kan dan beslissen welk gegeven nog bruikbaar is.",
          "Ook lege waarden verdienen zorg. Een lege notitie overschrijft geen eerdere belnotitie. Een ontbrekend telefoonnummer bewijst niet dat het bedrijf telefonisch onbereikbaar is. Door onbekend, leeg en tegenstrijdig uit elkaar te houden, voorkomt u dat een nette eindtabel meer zekerheid uitstraalt dan de bronnen toelaten.",
        ],
      },
      {
        heading: "4. ‘Gecontacteerd’ is een werkregel, geen bewezen status",
        paragraphs: [
          "Veel teams leiden uit een vrije notitie af dat een bedrijf al gecontacteerd is. Dat kan nuttig zijn voor planning, maar het blijft een werkregel. ‘Voicemail’, ‘mail gestuurd’ en ‘offerte besproken’ beschrijven verschillende situaties. Zonder afgesproken definitie kunt u niet beweren dat iedere gemarkeerde rij werkelijk een volledig gesprek heeft gehad.",
          "Laat daarom zien waarom een record als gebruikt wordt beschouwd, bijvoorbeeld omdat een bronkolom een datum bevat of een notitie een afgesproken trefwoord gebruikt. Deel de rest praktisch in als ongebruikt of nakijken. Zo krijgt het belteam richting, terwijl twijfel zichtbaar blijft en oude informatie niet als bewezen CRM-status wordt voorgesteld.",
        ],
      },
      {
        heading: "5. Leer van het bestand, maar beloof geen omzet",
        paragraphs: [
          "Een verzameling bestaande klanten, afwijzingen en belnotities kan kenmerken tonen die vaak terugkomen. Daarmee kunt u een voorlopig doelgroep-profiel maken: sectoren, regio’s of bedrijfsgroottes die vaker relevant lijken. Laat een gebruiker dat voorstel bevestigen voordat het de selectie verandert.",
          "Zo’n profiel is een hulpmiddel om prioriteit te geven. Het voorspelt geen verkoop en bewijst niet dat vergelijkbare bedrijven klant zullen worden. Notities kunnen onvolledig of verouderd zijn en de oorspronkelijke lijst kan al een sterke selectiebias hebben. Gebruik het patroon als startpunt voor controle, niet als automatische score die menselijk oordeel vervangt.",
        ],
      },
      {
        heading: "6. Kies de route die bij uw bestanden past",
        paragraphs: [
          "BelgoBase maakt een bewust onderscheid tussen een kleine webupload en lokale verwerking op de desktop. De webroute accepteert een tijdelijk Excel- of CSV-bestand tot 4 MB om een doelgroep te helpen bepalen. Die route is bedoeld voor een beperkte invoer; geüploade contactrijen worden niet als volledige dataset naar het AI-model gestuurd.",
          "Voor grotere lokale verzamelingen kan de desktopanalyse tot 100 .xlsx-bestanden verwerken, met maximaal 32 MiB per bestand en 512 MiB totale invoer, naast aanvullende verwerkingsgrenzen. De bestanden worden lokaal samengebracht en gerapporteerd. ZIP-, PDF-, oude XLS- en macrobestanden horen niet bij die route. Welke route u ook kiest: controleer het rapport en de conflictgroepen voordat u een nieuwe bellijst gebruikt.",
        ],
      },
      {
        heading: "7. Hergebruik voorkomt opnieuw beginnen",
        paragraphs: [
          "Na de opschoning heeft u meer nodig dan een eenmalige export. Bewaar het samengebrachte bedrijfsbeeld, de bronverwijzingen, beslisregels en nieuwe belresultaten. Wanneer later een verse bedrijfsselectie binnenkomt, kunt u die eerst vergelijken met wat al bekend is. Nieuwe officiële gegevens vullen het dossier aan; eerdere notities blijven herkenbaar als interne werkhistorie.",
          "Dat hergebruik voorkomt dat dezelfde data telkens opnieuw wordt gekocht, verzameld of uitgezocht. Het maakt ook duidelijk welke records echt nieuw zijn en welke alleen opnieuw werden aangeleverd. De winst zit in continuïteit: een collega ziet wat al gebeurde, wat onzeker is en wat de volgende handeling kan zijn, zonder dat u een volledige CRM-dekking of gegarandeerde contactgegevens hoeft te suggereren.",
        ],
      },
    ],
    relatedLinks: [
      { href: "/nl/klantenbestand-analyseren", label: "Bekijk de toepassingspagina over klantenbestanden analyseren" },
      { href: "/nl/prospectielijsten", label: "Lees hoe BelgoBase selecties naar Excel brengt" },
    ],
  },
] as const satisfies readonly BlogArticle[];

export type BlogSlug = (typeof blogArticles)[number]["slug"];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find((article) => article.slug === slug);
}

const dateLocales: Record<Locale, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
  en: "en-GB",
};

export function formatBlogDate(publishedAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${publishedAt}T00:00:00Z`));
}
