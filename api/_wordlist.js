// v357: imported offensive-word list (data only, no code), used by api/_words.js as WHOLE words only (never inside another word).
// WARNING: this file contains offensive words on purpose.
// Sources, latin-script entries only (an @handle can only hold a-z 0-9 _ .), lower-cased, accents removed, separators removed, 3+ letters:
// - « List of Dirty, Naughty, Obscene, and Otherwise Bad Words » © 2012–2020 Shutterstock, Inc., CC BY 4.0
// (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words, npm « naughty-words » 1.2.0, all latin-script languages);
// - npm « cuss » 2.2.0 by Titus Wormer, MIT (en, fr, es, it, pt, pt-pt, ar-latn): only the words rated 2 (« surely profane »);
// - npm « profane-words » 2.1.0 by Zac Anger, WTFPL (English);
// - npm « @2toad/profanity » 3.3.0, MIT: English list only (its other languages are machine translations full of ordinary words).
// Removed by hand after review (2026-11-13): ordinary or cooking words of the 6 app languages that these lists contain (« burro », « »,
// « leche », « moule », « morue », « queue », « sbattere », « montare », « boniato », « cebollino », « piment », « porc », « mettre »…) and
// identity words that are not insults (« gay », « homosexual », « lesbica »…), and after the scan of the app vocabulary: « frango », « finocchio »,
// « kraut », « panna », « hui », « frango assado », « nut butter », « jelly donut », « salle des fêtes », « beanbag », « limer », « cheesehead »; and after a scan of the 30,000 most common words of fr / en / es / de / it / pt: everyday words such as
// « con » (es / it « with »), « fica » (pt), « pede », « bite » (en), « retard », « pipe », « pédale », « gland », « pine », « ménage », « schmuck » (de), « bimbo » (it),
// « coger », « chaqueta », « pistola », « porco », « caca », « duche », « pinga » (cachaça), « suína », « caçando »… (full list in the v357 changelog of CLAUDE.md), « sht », « rape » (« râpé ») and « hure » (food or everyday words). The hand-made lists in api/_words.js always come first.
// To regenerate: install the 4 packages in a scratch folder, read their data (never run their code), normalise like normWord(), drop the
// review list, write the words here. Words are separated by spaces.
export const LIST = new Set(`
2adeeb 2g1c 2girls1cup 3abeet 3agala 3ahera 3akroot 3arbagy 3ars 3as 3asba 3ass 3attay 3ayba 3eer 3el2 3ezgetek 4r5e
5anith 5anza 5anzeer 5anzer 5ara 5awal 5h1t 5hit 5ht 5oneeth 5oneth 5orm 5ra 7akeer 7alama 7amka 7aqeer 7aywan 7omar
9a7ba a55 a55hole a7a aand aandu aardappelsafgieten abanto abbo abbuc abeed aborto abrazafarolas achier
achterhetraamzitten acouillesrabattues acrotomophilia adefesio adufe afberen aflebberen africoon afrossen afrukken
aftrekken afwerkplaats afzeiken afzuigen agarraderas aguayon ahbal aheccun ahole airi ajehnid alabamahotpocket alacon
alaroulemoilescouillesdanslalaitue alaskanpipeline alcornoque alfenique alfrednussi allerauxputes allerliberermandela
allerniquersamere allersefaireempapaouter allersefaireenculer allersefairefoutre allersefairemettre allezvousfairefoutre
alligatorbait allupato amcik amlar ammucchiata anakkangputa anal analannie anale anali analprobe analritter analsex
andorga andskota andurriasmo anilingus aniz anus apara apeshit aqerqur ar5e arabush arabushs archifoutre areola areole
argie armos arrapa arrapamenti arrapamento arrapando arrapano arrapare arrapate arrapati arrapato arrastracueros arrecho
arrivercommelemarquisdecouilleverte arrombada arrombado arrse arrusa arruso arsch arschficker arschlecker arschloch arse
arsebandit arsehole arsle artaban aryan asba asbak asesinato ash0le ash0les asholes asphalteuse ass assatanata
assatanate assatanati assatanato assbag assbagger assbandit assbang assbanged assbanger assbangs assbite assblaster
assclown asscock asscowboy asscracker asses assface assfuck assfucker assfukka assgoblin assh0le assh0lez asshat asshead
assho1e asshole assholes assholz asshopper asshore assjacker assjockey asskiss asskisser assklown asslick asslicker
asslover assman assmaster assmonkey assmunch assmuncher assnigger asspacker asspirate asspuppies assrammer assranger
assshit assshole asssucker asswad asswhole asswhore asswipe asswipes astiquer asxuzed atarre attai autoerotic avergallon
avoirdelachatte avoirdelamerdedanslesyeux avoirdelamoule avoirdescouilles avoirdescouillesaucul avoirducul
avoirdupoilaucul avoirlagueuledanslecul avoirlatetedanslecul avoirleculbordedemedailles avoirleculbordedenouilles
avoirlefeuaucul avoirlepapierquicolleauxbonbons avoirlescouilles avoirlesnerfs avoirlesrideauxquicollentauxfenetres
avoirlesyeuxentroudebite avoirlesyeuxentroudepine avoirletrouduculenchoufleur avoirpleinlecul avoirunbalaidanslecul
awellaq axuzzid ayaar ayir ayotes ayre azazel azz azzhole b00b b00bies b00biez b00bs b00bz b17ch b1tch b7ch ba8l babaca
babaovo babeland babes baboso babybatter babyjuice backdoorman badalhoca badalhoco badeen badfuck bagasce bagascia
bagassa bagasse baggerschijten baghl bagnarsi bagos baisable baise baiser baisercommedeslapins baisercommeunlapin
baiserfanny baiseur baitola balalao balatkar balatkari baldracca baldracche baldraccone baldracconi balen balfasz
balfaszok balfaszokat balfaszt ballbag ballgag ballgravy ballkicking balllicker balllicking ballsack ballsucking balurde
bampot bandercommeunane bandercommeuncerf bandercommeuntaureau bandercommeunturc bandook bangbro bangbros bangbus
baraputes barbook bareback barelylegal barenaked barf barface barfface barmok barmokat barmot barom barrabas
barriobajero barzotta barzotte barzotti barzotto bassterd bassterds bastard bastardata bastardate bastarde bastardo
bastards bastardz basterds basterdz bastinado baszik batrona battona battone battyboy bayag bayra bazmeg bazongas
bazooms bazr bbw bch bdsm beaner beaners beaney beaneys beardedclam beastality beastial beastiality
beastility beatch beatoff beatyourmeat beavercleaver beaverlips bebecharcos bebum bedan bedonderen beefcurtains beeyotch
befborstel beffen behenchod bekken belazeren belini belino bellaco bellend belloto benzer beotch berkaka berzotas besht
beskeletta besodemieterdzijn besodemieteren bestiadio bestiality besugo betetrakab betichod beurt beyetnak
beyetrakab bezaz bhadva bhadve bhandve bhangi bhootnike bhosad bhosadike bi7ch biatch bich bicha bicurious bietaze
biffle biffler bifle bifler biga bigass bigbastard bigblack bigbreasts bigbutt bigknockers bigornette bigtits
bimbaminkia bimbeminkia bimbiminkia bimbominkia bimbos bint birdlock biscate bitch bitchass bitched bitcher
bitchers bitches bitchez bitchin bitching bitchslap bitchtit bitchy bitembois biteme bitties
bivouaquerdanslacrevasse bixa blackcock blackman blacks blc bloblos blondeaction blondeonblonde blondeonblondeaction
bloodclaat blowj blowjob blowjobs blowyourl blowyourload bluegum bluegums bluewaffle blumpkin boang boazuda bobalicon
bocabuzon bocachancla bocallanta bocchina bocchinara bocchinare bocchinari bocchinaro bocchini bocchino boceta boche
boches boco boemelen boerelul boerenpummel boffing bofilo bogan bohunk boiadio boiata boink boiola boiolas bokkelul
bolagato bollera bollick bollock bollocks bollok bollox bolosser boludo bombeatomique bombin bomd bonasse bonazza
bonazzo boncoup bondage boned boner boners bong bonnasse bonze boob boobe boobies boobs booby boody boofta boong boonga
boongas boongs boonie boonies booobs boooobs booooobs booooooobs bootee bootlip bootlips booty bootycall boozer boquete
boquimuelle bordel bordelacul bordelaculdepompeamerde bordelaculpompeamerde bordeldemerde bordello borondanga borraja
borrico bosche bosches boschs bosnioule bosomy bosseta bosta bostazo botarate botergeil botterlecul boucaque bouffable
boufferlachatte boufferlecul bougnoul bougnoule bougnoulisation bougnouliser boukak bounioul bounioule bountybar
bountybars bourrerlemou bourriquer boyaucullier brackmard branlage branlecouille branlee branler
branlerlemammouth branlette branletteespagnole branletteintellectuelle branleur branleuse branlo branlotter bratze
brauliodeborracha brea5t breastjob breastlover breastman brele brioco brisco briseburnes briserlesnoix brizna brocha
broekhoesten bronha brouteminou brouterlecresson brouterlegazon brouterlescouilles brownshower brownshowers brugpieper
brunetteaction btch btchin btetnak bucaiola bucaiolo buceta buciadiculo buciodiculo bucodiculo buddhahead
buddhaheads budiulo bufarron buffelen buffies bufter bufty bugger buggered buggery bugren bugri bugru buitendepotpiesen
bujarra bujarron bukake bukkake buksza bukszak bukszakat bukszat bules bullcrap bulldike bulldyke bulletvibe bullshit
bullshits bullshitted bullturds bumblefuck bumboy bumbum bumchum bumfuck bumrobber bumsen bunda bunduda bung bunga
bungas bunghole bunnyfucker bur burat burdel burdelmama burne burok burrhead burrheads busona busone busoni
bussanga busseta busty butchbabes butchdike butchdyke butifarra butt buttbang buttcheeks buttface buttfuck buttfucker
buttfuckers butthead butthole buttman buttmuch buttmunch buttmuncher buttpirate buttplug buttstain buttwipe buzna byatch
bychara byk bylsia bzazlha c0ck c0cks c0cksucker c0k cabecipelao cabestro cabezaalberca cabezabuque cabrao cabron
cabrona cabrones cacano cacare cacarella cacarelle cacarsi cacasotto cacata cacate cacca caccata caccona
caccone caceta cacete cacha cachapera cachar cacheteo cachilo cachimba cachufleta caciocappella caciocappelle
cacker cacone cafre caga cagada cagado cagalindes cagao cagar cagare cagarruta cagarse cagasse cagata cagate cagati
cagato cagna cagnamadonna cagoince cagon cagona cahba cahone calabazo calambuco calduo caliboire calientahielos calisser
calzamonas cameljockey cameljockeys cameltoe camgirl camisinha camslut camwhore cancara cancare cancari cancaro canedio
cannate cannati cannato cansalmas cantamananas cantimplora capullo caracaballo caracarton caraculo caradepupu caraflema
carajaula carajote caralhinho caralho carapapa carapijo carpetmuncher carruth casci cassebonbon casseburette
cassecouille cassecouilles casserlagueule casserlepot casserlesboules casserlesburnes casserlescouilles casseta
castronaggine castronata castronate castroneria castronerie cawk cawks cazurro cazzata cazzate cazzeggi cazzeggia
cazzeggiano cazzeggiare cazzeggiate cazzeggio cazzi cazziata cazziate cazziatona cazziatone cazzimma cazzo cazzodicane
cazzone cazzoni cazzuta cazzute cazzuti cazzuto cenutrio ceoene ceporro cernicalo cerote chacunsamerde
chagasse chagatte chakke chalb chancay chapero charmouta charran chatbite chatte chaudepisse chav chcanky
checca checche checchetta checchette checheca cheeseeatingsurrendermonkey cheeseeatingsurrendermonkies
cherchemerde chereca chernozhopyi cherrypopper chiantcommelalune chiappa chiappona chiappone chiapponi
chiasse chiasser chiatique chiavabile chiavando chiavano chiavare chiavata chiavate chiavati chiavato chiaviamo chiavo
chibre chichi chichiman chickslick chiee chiennasse chier chiercommetoutlemonde chierdanslesbottes chierdanssonfroc
chierie chierpourlamarine chierunependule chieur chifar chifruda chifrudo chimar chinaal chinaman chinamen chinaswede
chinaswedes chinc chincs chinga chingaamadre chingado chingar chingatumadre chingchong chingchongs chink chinki chinks
chinky chiotte chiottes chiquilicuatre chirimbaina choad chocho chochota chocolaterosebuds chod chode chodes chodu
chodubhagat chonkies chonky chonkys chooche choochi choope choot chootia chootiya chootkebaal chota choune chraa
christkiller christkillers chucha chuche chuchi chudaap chudaikhanaa chudamchudai chude chug chugs chuj chujnia chunger
chungers chunkies chunkys chupacables chupada chupapollas chuparla chupasangre chuperson chupeton chupoptero
chutad chutadd chutan chutia chutiya chutkachuha chutkachuran chutkamail chutkebaal chutkedhakkan chutmaarli cialis
cicciona ciccione ciccioni cierrabares ciesulino ciesulo cingene cingenede cingeneden cingeneler cingenelerde
cingenelerden cingenelere cingeneleri cingenelerin cingenenin cingeneye cingeneyi ciolla ciolle ciospo ciota cipa cipote
circlejerk ciucciacazzi ciucciacazzo ciucciamiilcazzo ciula ciulando ciulano ciulare ciulata ciulate ciulati ciulato
ciuli ciulo cl1t clamdigger clamdiver clansman clansmen clanswoman clanswomen claquemerde clevelandsteamer clille clit
clitface clitfuck clito clitoris clitorus clits clitty clogwog cloverclamps clusterfuck cnts cntz cnut cocain cocaina
cocaine cocheche cock cockbite cockblock cockblocker cockburger cockcowboy cockface cockfight cockfucker cockhead
cockholster cockjockey cockknob cockknocker cockknoker cocklicker cocklover cockmaster cockmongler cockmongruel
cockmonkey cockmunch cockmuncher cocknob cocknose cocknugget cockqueen cockrider cocks cockshit cocksman cocksmith
cocksmoker cocksucer cocksuck cocksucked cocksucker cocksucking cocksucks cocksuka cocksukka cocktease cocky cocones
cogliona coglionano coglionare coglionata coglionate coglionati coglionato coglione coglioni cogollo cogote cohee
coital coito coitus cojido cojieron cojiste cojones cok cokmuncher coksucka colgazon colhoes colipato colison collofe
colloma comadres comebolsas comechapas comeflores comemierda comestacas commepapadansmaman commeunchienfoutsamerde
commie cona conas conchadetumadre conchier conchudo concommeunbalai concommeunebite concommeungland condom connard
connarde connasse conne conneau connerie contrecrisser coochie coochy coolie coolies cooly coon coonass coonasses
coondog coons cooter copaindebaise copeton copinedebaise coprofagia coprolagnia coprophilia copulate coquillard
coquimbanos coregge coreggia corksucker cornhole cornudo cornute cornuti cornuto coronta corota corotas corozo
coso5tak cosomak cotorra couille couilledeloup couillemolle couilles couillesaupoteau couillu coupdepute
couterlapeaudescouilles couterlapeauducul couterunecouille coyoles coyones coyos cra5h cracka crackcocain crackpipe
crackwhore cramouille crap crapola crapper crappy craquersonslip craquersonstring cravacherlepursang creampie cretina
cretino crica crisse crissement crosser crotchjockey crotchmonkey crotchrot crucca crucche crucchi crucco
cruchasse csocs csocsok csocsoket csocsot cuacha cuaresmeno cuates cuccando cuccano cuccata cuccate cuccati cuccato
cucco cuck cucon cucona cueco cuerpoescombro cul cula culamen culasse culatella culatone culatoni culattella culattina
culattine culattone culattoni culattun culbuter culeado culear culer culero culeter culeur culo culopollo culos cum
cumbubble cumdumpster cumet cumface cumfest cumguzzler cuming cumjockey cumlicker cumlickr cumm cummer cummin cumming
cumquat cumqueen cums cumshot cumshots cumslut cumstain cumsucker cumtart cunilingus cunillingus cunn cunnie cunnilingio
cunnilinguo cunnilingus cunntt cunny cunt cunteyed cuntface cuntfuck cuntfucker cunthole cunthunter cuntlick cuntlicker
cuntlicking cuntrag cunts cuntslut cuntsucker cuntz curak currymuncher currymunchers cushi cushis cuyones cuzao cyalis
cyberfuc cyberfuck cyberfucked cyberfucker cyberfuckers cyberfucking cybersex cyberslimer cyc d0ng d0uch3 d0uche d1ck
d1ld0 d1ldo d4mn da3ara da3era dago dagos dahmer danstoncul darkey darkeys darkie darkies darky darorabo darumaqueca
dasklotenvandebok daterape datnigga dawgiestyle dayerkizebbi daygo dayooth dayoth dayouth deapthroat debagouler deballen
debander deboiter debroussaillerlatranchee decalisser deconnade deconnage decrisser
deculer deenabook deenomak deepaction deepthroat deepthroating defecate defonceur defourailler deggo
deglinguer dego degos degueulassement dehoerspelen dehonduitlaten deiouse dekofferinduiken demerdeyourself demescouilles
demesdeux demimolle demonvier dendrophilia depijpuitgaan depucelage depuceler deroulerducable descerebrado
descouilles desengorger desgarracalzas desgracada desgracado desgraciarse destroyyourpussy deth diaperdaddy
diaperhead diaperheads diarrhee dick dickbag dickbeater dickbeaters dickbrain dickdipper dickface dickflipper
dickforbrains dickfuck dickhead dickheads dickhole dickish dickjuice dickless dicklick dicklicker dickman dickmilk
dickmonger dickpic dickripper dicks dicksipper dickslap dickslicker dicksucker dickwad dickweasel dickweed dickwhipper
dickwod dickzipper diddle dieumepignole dieumetripote dike dilater dild0 dild0s dildo dildos dilf diligaf dilld0 dilld0s
dillweed dimwit dingle dingleberries dingleberry dink dinks diobestia dioboia diocane diofek diofeka dioinfame
diolegnetto diolurido diomaiale diomerda dioporco dioporcone diopporco diostronzo diosuino dipship dipshit dipstick
dirsa dirtypillows dirtysanchez discofitta ditalino dixiedike dixiedyke djoc dlck dmuchac dodel doeser dogfucker
doggiestyle doggin dogging doggystyle dogstyle doigter dokurwynedzy dolboyeb dolcett dombo dominatricks
dominatrics dominatrix dommes dondiego donkeypunch donkeyribber donnadie doochbag doodoo doofus dookie doosh dope dopice
doprdele dothead dotheads doubledong doublepenetration douch3 douchebag douchebags douchefag douchewaffle douchey
dpaction draaikont draathelvete dragqueen dragqween driehoogachterwonen dripdick drisser drittsekk drogas drol
drooggeiler droogkloot drouille drstka dryhump drzka dtc ducon duconnot dudette dugland dumass dumb dumbass
dumbasses dumbbitch dumbfuck dumbshit dumraio dumshit dunecoon dunecoons dupa dupek duperele durelli durello dvda dyefly
dyke dykes dziwka e8tesab eacha earotics easyslut eatadick eatballs eathairpie eatme eatmy eatmyass eatpussy ebalnik
ebalo ebalomschelkat eburne ecchi echacantos ecouille eenbeurtgeven eenhalvemaneneenpaardekop eennummertjemaken
eenwipmaken eghtesab eiacula eiaculando eiaculano eiaculare eiaculazione eiaculi eiaculo eightball eightballs eikel
ejackulate ejaculation ejakulate ejarramantas ekrem ekto elputoese elputoquetepario emmanche emmancher emmerdant emmerde
emmerder emmerdeur emmerdeuse empapaoutage empiernarse emputado emputecido enavoirdeux enavoirpleinlecul
enavoirpleinlescouilles enavoirraslesburnes enchier enconnade enconner encuguler enculable enculade enculadedemouche
enculagailler enculage enculagedemouche enculagedemouches enculailleur enculatoire encule enculedetamere enculedetarace
enculee enculement enculer enculerie enculerlesmouches enculette enculeur enculeurdemouches enculeurs enculeuse enema
energumeno enfantdechienne enfantdeputain enfantdepute enfler enfoire enfoiree enfoirer enfourailler enfoutrer engerd
engrosser engueuler entrecouilles entuber envoyerchier envulver erection erotic erotism esbaratabailes
escolimoso escornacabras escrota esperma esporra esqua essohbee estafiate esticazzi estie estulto estupido ethicalslut
ethwel etranglerleborgne etrechie etrecouillu etrelafete etremoudelabite etron ettaconnerie eunuch evl excrement exkwew
exploserleterrier extacy extasy f4nny faccedaculo facciadaculo facedepet facefucker fachar fack faeces faen
faenihelvete fag fag1t fagbag faget fagfucker fagg fagg1t fagged fagging faggit faggitt faggot faggotcock faggs fagit
fagot fagots fags fagt fagtard fagz faig faigs faigt fairechier fairechierlabite fairecrapahuterleflemmard faireminette
fairesapute faireuncacanerveux fanculo fandeputain fanfosquero fanken fannybandit fannyflaps fannyfucker
fantdepute fanyy far5 farasa farg fargirareicoglioni fariseo fartknocker farty fash5 fash5a fastfuck fasz faszfej
faszfejek faszfejeket faszfejet faszok faszokat faszt fatah fatass fatfuck fatfucker fatso fattone fattoni fazerumbico
fck fckcum fckd fcuk fcuker fcuking fdp fecal feck fecker feg fek feken fekfikanto feklekulo fekulo felatio felch
felcher felching fellate fellatio feltch feltcher feltching femalesquirtin femalesquirting femdom femminucce femminuccia
fermersagueule fermersonclaquemerde fermetagueule fessa fesse fessi fesso fetish fick ficken fiestadesalchichas fif
fifar fifi figa figging fighe fighetta fighette fighetti figliadiputtana figliadiputtane figliaditroia figliaditroie
figlidiputtana figlidiputtane figliditroia figliditroie figliediputtana figliediputtane figlieditroia figlieditroie
figliodibuonadonna figliodiputtana figliodiputtane figlioditroia figlioditroie figone fik fikado fikema fikfek fiki
fikigi fikigu fikilo fikklauno fikota fiku filhadaputa filhodaputa filimincias filleapedes filledepute filmdeboule
filmdeboules filsdebatard filsdechien filsdechienne filsdegarce filsdeputain filsdepute filsdeputerie filsdetarace
fingerbang fingerfood fingerfuck fingerfucked fingerfucker fingerfuckers fingerfucking fingerfucks fingok
fingokat fingot finocchione finocchioni fiofo fion fiotte fissehar fisted fister fistfuck fistfucked
fistfucker fistfuckers fistfucking fistfuckings fistfucks fisting fisty fitt fitte fittig fiut flamer flamoes
flange flasher fleto flikken flikker flippingthebird flittchen flogthelog floo floozy flundra flydie flydye foad foda
fodase fode foder fodida fodido foirade fok foligoso follador follar fondle foobar fook fooker footaction footfetish
footfuck footfucker footjob footlicker footstar forbanna forbannet foreskin forfiki forfikigu forfiku forfurzu
forhelvete forjaevlig fornicate forpisi forpisu forrar fotte fottendo fottere fottersene fottersi fottuta fottute
fottuti fottutissima fottutissime fottutissimi fottutissimo fottuto fotze foufoune foufounette fouillemerde foune
fourbir foursome fourtwenty foutagedegueule fouteur fouteurdemerde foutoir foutre foutrelamerde foutrelapaix
foutrelecamp foutresurlagueule foutriquer fracicone francok francokat francot fratze freakfuck
freakyfucker freefuck freex fregna fregnacce fregnaccia fregne frigg frigga frigger frocetti frocetto froci frociaggine
frociata frociate frocio frocione frocioni frosci froscio frotting fubar fuc fucck fuck fucka fuckable fuckass fuckbag
fuckbitch fuckbook fuckboy fuckbrain fuckbuddy fuckbutt fuckbuttons fuckd fucke fucked fuckedup fucker fuckers
fuckersucker fuckface fuckfest fuckfreak fuckfriend fuckhead fuckheads fuckher fuckhole fuckin fuckina fucking
fuckingbitch fuckings fuckingshitmotherfucker fuckinnuts fuckinright fuckit fuckknob fuckme fuckmeat fuckmeboots
fuckmehard fuckmonkey fuckn fucknugget fucknut fucknuts fucknutt fucknutz fuckoff fuckpig fuckpuppet fuckr fucks
fuckstick fucktard fucktards fucktoy fucktrophy fuckup fuckwad fuckwhit fuckwhore fuckwit fuckwitt fuckyomama fuckyou
fudendo fuder fudgepacker fudida fudido fugly fuk fukah fuken fuker fukin fuking fukk fukkah fukken fukker fukkin
fukking fuks fuktard fuktards fukwhit fukwit fulastre fuleira fundillo funfuck fuoridaicoglioni fuoridallepalle furzulo
futanari futanary futkretzn fuuck fux fux0r fuxor fvck fvk fxck fyfaen g00k gaand gaandfat gaandmasti gaandufad gables
gadverdamme gae galbak gamoosa gamosa ganapan ganapio gandfattu gandu gangbang gangbanged gangbanger gangbangs gangsta
ganja garageabite garageabites garchar garompa gashti gassyass gasti gat gatorbait gawad gayass gaybob gayboy gaydo
gaygirl gaylord gaymuthafuckinwhore gaysex gaytard gaywad gayz gaznapiro geci gecibb gecik geciket gecit gedoogzone
geezer geilneef gema3 genital genitals gesodemieter getiton gey gfy ghassa ghasti ghay ghey ghuycha giantcock gigolo
gilipichis gilipollas gilipuertas ginzo ginzos gipp gippo gippos gipps giraesquinas girlon girlontop girlsgonewild
givehead glans glaoui gnasse gniouf gnocca gnocche gnoul gnoule goatcx goatse godam godammit godamn
godamnit goddam goddamit goddamm goddammit goddamn goddamned goddamnes goddamnit goddamnmuthafucker godsdamn godverdomme
gokkun goldenshower goldone golliwog golliwogs gonad gonads gonorrehea gonzagas gooch goodpoop googirl gook gookeye
gookeyes gookies gooks gooky gora goras goregasm gorrino gorrumino gote gotler gotlerde gotlerden gotlere gotleri
gotlerin gotohell gotte gotu gotun gotveren gotverende gotverenden gotverene gotvereni gotverenin gotverenler
gotverenlerde gotverenlerden gotverenlere gotverenleri gotverenlerin gougnote gougnoter gouine gourdin gousse gowno
gownoprawda goy goyim graftak grandefolle grasmaaien gratenkut greaseball greaseballs greaser greasers grelho
grelinho grelo greppeldel griet gringo gringos groe grogniasse groid groids grope grostulation grouille groupsex gspot
gstring gtfo guaranga guardona guardone guardoni gub gubba gubbas gubs gucchi gucchu guebo gueule gueuler guiena
guitarro guizi gummer guro gurriato gwailo gwailos gweilo gweilos gyopo gyopos gyp gyped gypo gypos gypp gypped gyppie
gyppies gyppo gyppos gyppy gyppys gypsies gypsy gypsys h00r h0ar h0m0 h0mo h0r h0re h4x0r haahka habahela hacerunamamada
hacerunapaja haciendoelamor hackfresse hadji hadjis hairyback hairybacks haistapaska haistavittu haji hajis hajji hajjis
hajzl hakeer halfbreed halfcaste hamama hamas hamflap handjob haole haoles hapa haqeer harami haramzade hardcore
hardcoresex hardon hassia hatchounyemak hatullinen hawas hawaskepujari hawi haygan hbeela hbila he11 headfuck hebes heeb
heebs helvete helvetet helvetisti hentai heroin heroina herp herpes herpy heshe hestepik hevonkuusi hevonpaska
hevonperse hevonvittu hevonvitunperse hijadeputa hijaputa hijda hijodemilputas hijodeputa hijoputa hijra hillbillies
hillbilly hindoo hiscock hitler hitlerism hitlerist hitosti hitto hoare hobag hodgie hoempert hoer hoerenbuurt
hoerenloper hoerig hoes holestuffer hom hom0 homar homemgay homobangers homodumbshit homoerotic homoerotico homoey
honger honkers honkey honkeys honkie honkies honky hooch hooker hookers hoor hoore hootch hooter hooters hori horis
hork horndawg horndog horney horniest horny horseshit hosejob hoser hotcarl hotchick hotdamn hotpussy hotsex hottotrot
hovno howtokill howtomurdep howtomurder huelegateras huevon hufter hugefat huisdealer huj hujciwdupe humped humper
humpher humphim humpin humping huorata hurensohn hussy hustler hway hwiha hymen hymie hymies iblowu ibnal3ahra
idiot idiota idiotice iheccan iheccunen ikes ikey ikeymo ikeymos ikwe illegals imbaisable imbecil imbeciles imbecille
imbitabilite imbitable immerdato impiccati incazzano incazzarsi incazzata incazzate incazzati incazzato incazziamo
incazzo incazzosa incazzosamente incazzose incazzosi incazzoso incest inchiappetta inchiappettando inchiappettano
inchiappettare inchiappettata inchiappettate inchiappettati inchiappettato inchiappetti inchiappettiamo inchiappetto
inchiavabile incoglionirsi incoglionita incoglionite incoglioniti incoglionito incula inculando inculano inculare
inculata inculate inculati inculato inculi inculiamo inculo inculoallabalena inculone inculoni indon indons
infamedio ingoio injun injuns insest intercourse intheass inthebuff ische iwellaqen j3rk0ff jackass jackhole jackoff
jackshit jacktheripper jaevla jaevlig jailbait jajco jajko jakol japcrap japie japierdole japies japs jarrar jatka
javlar jebac jebany jebat jebus jerk0ff jerked jerkoff jerries jewboy jewed jewess jhant jhantchaatu
jhantkakeeda jhantkebaal jhantkepissu jhantu jiga jigaboo jigaboos jigarooni jigaroonis jigg jigga jiggabo jiggaboo
jiggabos jiggas jigger jiggerboo jiggers jiggs jiggy jigs jihad jijjiboo jijjiboos jilipollas jimfish jisim jism jiss
jiz jizim jizin jizjuice jizm jizn jizz jizzd jizzed jizzim jizzin jizzn jizzum joder johny jossa joualvert jouir
journalope jru jugg juggalo juggs junglebunnies junglebunny junky juostenkustu jutku jutsku ka7ba kacap kacapas kacaps
kacen kackbratze kacke kacken kackwurst kaco kacsuculo kaffer kaffir kaffre kafir kaltaga kaltak kaltaklar kaltaklara
kaltaklarda kaltaklardan kaltakta kaltaktan kamine kaminey kampflesbe kanake kananpaska kanen kanjar kanker kantot
kapullo karrak katsap katsaps kawk kawwad kawwazi kenga kerfa kesekhtak kesemmak kettingzeug khanez khanith khanza
khanzeer khanzer khokhol khokhols kibaszott kibaszottabb kigger kike kikes kimchis kimme kinbaku kink kinkster kinky
kinkyjesus kissass kiunt kkk klaarkomen klan klansman klansmen klanswoman klanswomen klerebeer klojo klooien
klootjesvolk klootoog klootzak kloten knobbing knobead knobed knobend knobhead knobjocky knobjokey knobz knockers knor
knulla knulle kock koiranpaska kojono kokot kokotina kolairi kolkhara kollzakk kondum kondums konomrd kont kontneuken
kooch kooches koon kootch koso5tak kosomak kotthuvud kottnacke krap krappy krauts krentekakker kuffar
kuinesterinperseesta kuk kukene kuker kuksas kuksuger kulli kullinluikaus kum kumbubble kumbullbe kumer kumming kumquat
kums kunda kunilingus kunnilingus kunt kunts kuntz kuppainen kurac kurafi kurafik kurafikat kurafit kurva kurvak
kurvakat kurvat kurwa kurwy kusaista kuseksia kusettaa kushi kushis kusi kusipaa kussekryller kusta kut kutafon kutas
kutta kuttakamina kuttekiaulad kuttekijat kuttelikkertje kuttiya kwa kwailo kwailos kwakkie kwif kyke kykes kyopo kyopos
kyrpa kyrpanaama kyrpia kyrpiintya kyrpiintynyt kyrvitys l3ich l3itch la39 la7s labawy labia labwa ladilla lahtari
laisserpisserlemerinos lamecharcos lameculos lameplatos languedepute lapdance laputaindetamere laputaquetepario
laputaqueterecontrapario leatherrestraint leatherstraight leatherstraightjacket lebo lebos leccaciuffi leccaculi
leccaculo leccapalle lecchina lecchine lecchini lecchino lechecul lecherlecul lechuguino lecondesamere leggecibb
legkibaszottabb legnettodio legszarabb lehbeela lehbila lemonparty leper lesbain lesbayn lesbin lesbo lesbos letrin lez
lezbe lezbefriends lezbian lezbians lezbo lezbos lezz lezzian lezzie lezzies lezzo lezzy liberermandela libido licker
lickme liefdesgrot lilniglet limey limpdick limy lipshits lipshitz livesex lloramigas loadedgun lodu
lofa lofare loffa loffare loffe lolas lolita longanizas lopette lort loser louat louty lovebone lovegoo lovegun
lovejuice lovemaking lovemuscle lovepistol loverocket lowlife lsd lubejob lubra luckycammeltoe luder lugan lugans
luldebehanger lulhannes lumbreras lummel lundchoos lundkabakkal lundkhajoor lundtopi lundure luridamadonna
luridodio lusting lusty lutka m0f0 m0fo m3arras m45terbate ma5terb8 ma5terbate maakichut maal mabuno mabunos macaca
macacas machona maciza macizorra madarchod madhavchod madonnacagna madonnalurida madonnaprostituta madonnaputtana
madonnaslabbrata madonnatroia madonnavacca mafketel mafugly maganto magicwand mahbool mahbuno mahbunos maiala maialata
maialate maialedio maialone maialoni majadero makemecome makemecum makwa malasangre malasombra maldito malesquirting
maleton malhat malparido malpt mamada mamahuevos mamarla mameluco mamey mamhoon mamon mamplora mamporrero mamrd
mams mamsoo5 mamsookh mancheacouilles manegueta mangarran mangemerde mangerdelamarde mangiaparana mangiaparane
mangiapatata mangiapatate mangurrian manhater mannaggia manpaste manyak manyok manyook maquerellage maraco marha marhak
marhakat marhat marica maricon mariconazo maricos marijuana marioah mariposon marone marujo mas5a mas5ota masochist
masokist massterbait masstrbait masstrbate mastabate mastabater masterb8 masterbaiter masterbat masterbat3 masterbate
masterbates masterbating masterbation masterbations masterblaster mastrabator mastuerzo masturbacion masturbat
masturbate masturbating masturbation matacandiles matennaaier matje matny mattressprincess maumau maumaus mayate maybon
maybona mayboon mayboona mazloula mazouterlepingouin mcfagget meapilas meatbeatter meatrack mecos megdoglik
menageatrois menano menaswen menata menate menati menato mendrugo mentecato mequetrefe mercon merd merda merdacce
merdaccia merdacciadio merdadio merdai merdaia merdaio merdaiola merdaiole merdaioli merdaiolo merdasse merdata merdate
merde merder merderie merdeuse merdeux merdicite merdier merdina merdine merdogene merdone merdoni merdosa merdosamente
merdose merdosi merdoso meretrice merluzo mescouilles mescouillesletempssebrouille metemuertos metijaco metnak metnaka
metrama mettredanslasauce mettrelamisere mettrelaquenelledansleshaker mettresescouillessurlatable mettresurlagueule meuf
mezzasega mezzeseghe mfal2as mfal2asa mfannes mfannesa mfucking mgger mggor miboun mibun mickeyfinn mideast mierda
mignotta mignotte mignottone mignottoni mijada mijado mijole milf minchia minchiata minchie minchiona minchionando
minchionare minchionata minchione minchioni mindfuck mindundi minga minge minger missionaryposition mizera mkauda
mo3ak mo5anath mocciosa mocciose mocciosi moccioso mockey mockie mocky mocrea mocreia mof mof0 mofo mojarelbizcocho
mojarelchingolo mok9a7ba mokka7ba mokkahba moky molest molestation molester molestor mollard molopaa monata moncul
moneyshot mong monkleigh monvier monviermadameolivier moohmeinle moolie moona moonade moonar moonat mooncricket
mooncrickets mopse morfarse morgenlatte morlaco moron morraknuller morrapuler morroestufa morrongo moskal moskals
mosshead mota5alef motakhalef motasawel mothafuck mothafucka mothafuckas mothafuckaz mothafucked mothafucker
mothafuckers mothafuckin mothafucking mothafuckings mothafucks mothafuker mothafukkah mothafukker motherfuck motherfucka
motherfucked motherfucker motherfuckers motherfuckin motherfucking motherfuckings motherfuckka motherfucks motherfukah
motherfuker motherfukkah motherfukker motherfvcker motherlovebone mothrfucker motocultable motoculter moucheamerde
mouleamerde moulebite mouliewop moundofvenus mouron mozza mrdat mrdka mrdnik mrhands ms5ota mtherfucker mthrfuck
mthrfucker mthrfucking mtrfck mtrfuck mtrfucker mudack muerdesartenes muff muffdive muffdiver muffdiving muffindiver
mufflikcer muffpuff mufti muie mulatto mulkero mulkku mulkvisti muna munapaa munaton muncher munging munt muschi mussa
mussi musso mutakuono muthafecker muthafuckaz muthafucker muthafuckker muthafukah muthafuker muthafukkah muthafukker
muther mutherfucker mutherfucking muthrfucking mutiainen muts mutta mutth mutthal mzungu mzungus n1gga n1gger n1gr
naahachounyemak naaien naakt nackt nads nahwik naida nainti najayaz najayazaulaad najayazpaidaish naked nambla namm
naqal naqsh narttu nastt nastybitch nastyho nastyslut nastywhore navescuola nawashi nayekemmak nayekhareemek nazi nazis
nazism necro needthedick neek neekeri neger negra negre negres negress negretta negrette negretti negretto negri negro
negroes negroid negros neka7 nekru neonazi nepesaurio neplussesentirpisser nerchia nerchie nerienbranler neuken
neukstier nig niga nigar nigars nigas nigers nigette nigettes nigg nigg3r nigg4h nigga niggah niggahs niggar niggaracci
niggard niggarded niggarding niggardliness niggardlinesss niggardly niggards niggars niggas niggaz nigger niggerhead
niggerhole niggers niggle niggled niggles niggling nigglings niggor niggress niggresses nigguh nigguhs niggur niggurs
niglet nignog nigor nigors nigr nigra nigras nigre nigres nigress nigs nigur niiger niigr nikmok nimphomania nimrod
ninfo ninny nippel nipple nipplering nipples nips niquer niquersamere niquesamere niquetamere niquetarace nittit
nlgger nlggor nob nobhead nobjocky nobjokey nofuckingway nog nognog nookey nookie nooky noonan nooner nouna noune nsfw
nsfwimages ntm nude nudger nudie nudies nudity nulach nulachier numbnuts nuollapersetta nussia nussija nussinta
nutfucker nutsack nutte nutten nympho nymphomania obciagacchuja obciagacfiuta obciagacloda ock octopussy
oetlul ohhisseencule ojete olhodocu omorashi onanieren onecuptwogirls oneguy oneguyonejar onejar ontherag opgeilen
opizdenet opkankeren oprotten opsodemieteren opznhondjes opznsodemietergeven opzouten orafis orate ordure orgasim
orgasims orgasm orgasmic orgasmo orgasms orgasmus orgasum orgies orgy oriface orifiss orina orospu orospuda orospudan
orospular orospulara orospularda orospulardan orospunun orospuya orospuyu osama oslosoust osti ostoeblo ostokhuitelno
otaria otario otebis otmudohat otpizdit otsosi otuzbirci otuzbircide otuzbirciden otuzbirciler otuzbircilerde
otuzbircilerden otuzbircilere otuzbircileri otuzbircilerin otuzbircinin otuzbirciye otuzbirciyi ouioumerde
ouvrirsagrandegueule ouwehoer ouwehoeren ouwerukker ovejo ovum ovums p0rn paal paardelul pachacha pachole packi packie
packy padlo padulo paedophile pagafantas pajeado pajearse pajero paki pakie pakis pakkis paky palen palesimian
paljaalla palle palli pallit pallosa pallose pallosi palloso palucher palurdo pamplinas panarra pancakeface pancakefaces
paneleiro paneskella panettaa panocha panoli panooch pansies pansy pantava panti pantie panties panty papafrita
papallona papanatas papayona papiercul papirote pappone papponi parachuterunsenegalais paraculi paraculo pardillo
parechoc parechocs pargo parguela parleamonculmateteestmalade partirencouille paska paskainen paskamainen paskanmarjat
paskantaa paskapaa paskapuhe paskattaa paskiainen paskoa pasmarote pasmasuegras passarumcheque patacca pataka patakha
pataliebre patan patonza patonze pavitonto payo paysbas pazguato pcp pearlnecklace peaudezob pecholata pechugas
pecker peckerhead peckerwood pecorina pecorine pedecommeungrec pederasta pederasti pedik pedo pedobear
pedophile pedophilia pedophiliac pedoque pedorro peeenus peeenusss peehole peenus peepee peepshow peepshpw pegging pehko
peidar peido peinabombillas peinaovejas peinus pelagallos pelagambas pelagatos pelatigres pelazarzas pelek pelele peler
pelleamerde pelma pelot pelotudo pen1s pendejo pendy pene penetrate penetration peni peni5 penial penile penis
penisbreath penises penisfucker penisland penislick penislicker penispuffer penoze penseravecsabite penseravecsaqueue
pentele pentelha pentelho penus penuus pepeka pepom perdet perkele perkeleesti perrocostra perroflauta persaukinen
perseaalio perseennuolija perseetolalla persereika perslapi perspano persvako perv perversion pervertido peteralagueule
peterdanslasoie peterete peterlecul peterlescouilles petimetre petsauce petuh peyote pezon phalli phallic phonesex phuc
phuck phuk phuked phuker phuking phukked phukker phukking phuks phungky phuq pi55 picaninny picapleitos piccaninny picen
picha pichabrava pichat picio picka pickaninnies pickaninny picsa picsakat picsat picus pidargnoinyj pieceofshit piefke
piefkes pieprzyc pierdol pierdolec pierdolic pierdolnac pierdolniety pierdziec piesen pigfucker pija pijo pijpbekkieg
pijpen pik piker pikey pikhar pikk pikslugeri piksutteri piky pilinha pilkunnussija pillavispas pillowbiter pillu pillut
piltrafa pimmel pimp pimped pimper pimpern pimpis pimpjuic pimpjuice pimpsimp pinak pinakat pinat pincare pinchauvas
pinche pinciano pinciare pinciata pinciate pinciati pinciato pindick piner pinkeln pinko pinnolone
pinocumettable pinocumettre pintamonas piojoso pipari pipi pippaiola pippaiole pippaioli pippaiolo pipparola
pipparole pipparoli pipparolo pippetta pippette pippona pippone pipponi pirla piroca piru piscia pisciando pisciare
pisciasotto pisciata pisciate pisciati pisciato pisciatona pisciatone piscio pisciona piscione piscioni pisciosa
pisciose pisciosi piscioso pisella piselle pisello pises pisin pising pisof piss pisseaulit pissed pissen pisser
pisseralaraie pisserdelacopie pissers pissersacotelette pisses pisseur pissflap pissflaps pisshead pissin pissing
pissoff pisspig pistaa pistolotto pitanoso pitaquetepariu pito pitofloro pizda pizdato pizdatyi pizdet pizdetc
pizdoinakrytsja pizduk pizdyulina plancul planterlejavelotdanslamoquette playboy playgirl playo pleasurechest
pleurislaaier plotteacash pocaralho pocasluces pocha pochas pocho pochos pocketpool pocs pocsok pocsoket pocsot
podikuevo poeben poep poepen pofa pofakat pofat pognecul pohm pohms poimatnakonchik poitiposrat pojeb pojebany pok
pokhuy pokker polac polack polacks polak polesmoker polla pollas pollocks pollopera poluchitpizdy pomiciare pommie
pommiegrant pommiegrants pommies pommy pompeamerde pompinara pompinare pompinari pompinaro pompini pompino poms ponyplay
poo poof poofta poofter poon poonani poonany poontang poontsee poop poopchute pooper pooperscooper pooping
poorwhitetrash poot popel popierdolony popimp poppen porcaeva porcamadonna porcamiseria porcapputtana porcaputtana
porcatroia porchmonkey porchmonkies porcocazzo porcocristo porcoddio porcodio porcodue porcogesu porcola
porconedio porcoqua porcozio porcozzio porn pornflick pornking porno pornography pornos pornprincess poronga porra
porterlepet portiekslet pososimoyukonfetku poto potta potverdorie pouffiasse pougner poundtown pourlescouillesdupape
poussecrotte pousserlerepasdelaveille pousserunegueulante poutrer pplicker pqr pr0n pr1c pr1ck pr1k
prairienigger prairieniggers prcat prdel prdelka preteen pric prick prickhead pricks prig princealbertpiercing prissat
proebat promudobladsksyapizdoproebina pron propezdoloch prosrat prostituirsi prostituite prostituito prostituta
prostitutamadonna prostitute prostituto prutt pthc pu55i pu55y pube pubes pubic pubiclice pubis publiciteitsgeil
pucchiacchiera pucchiacchiere puchero pud pudboy pudd puddboy puke pulotti pulotto punani punanny punany punci puncik
punheta punkass punky puntang puppa puppalo puppami purinapricness pusies pusse pussee pussi pussie pussies pussy
pussycat pussydestroyer pussyeater pussyfart pussyfuck pussyfucker pussylicker pussylicking pussylips pussylover
pussypalace pussypounder pussys pusy puta putain putaincon putainde putaindebordeldemerde putaindemerde putaindemoine
putaindesamere putaindesarace putaindetarace putaka putangina putaquepariu putaquetepariu pute puteborgne putedeluxe
puto puttana puttanaeva puttanaio puttanamadonna puttanata puttanate puttane puttaniere puttanona puttanone puttanoni
puuke puuker puxasaco pyllyvako qahbeh qiyah qlawi qqan qqant qqu quashie queaf quebracho quebrachon queca queef
queerhole queero queers queerz queutard quickie quicky quiff quim quitahipos quvatlh qweers qweerz qweir r5e ra8s raand
raaskallen rabao rabuda rabudao rabudo rabudona raccrocheralagueule racista radasse raeva raeven raghead ragheads
ragingboner ramera ramoner ramonerletroudeballe randaap randi randirona raped raper raping rapist
raslamoule raslatouffe raslebonbon raslecul raslesfesses raspeezdeyi raspizdatyi rasselzebb rastrapajo ratisserlebunker
rattipaa rautenberg razyebuy razyoba rearend rearentry reata rebanasandias recalcada recalcado recchia recchione
recchioni recktum rectal rectum rectus recurerlamarmite redleg redlegs redlight redneck rednecks redskin redskins reefer
reempaffer reenculer reestie reet reetard reetridder reettrappenvoorzijn refucker reika remame remsporen remuerlamerde
renob rentafuck repisas rere retardada retardado retarded retardz retazo retourneauxasperges reudig
reutelen reva reversecowgirl revientabaules riata ricchione ricchioni rienaenculer rienafoutre riflard rigger rimjaw
rimjob rimming rincoglionimento rincoglionire rincoglionirsi rincoglionita rincoglionite rincoglioniti rincoglionito
ripsipiirakka ritard rizzarsi robaperas robicloda rompiballe rompicazzo rompicoglioni rompimaroni rompimarroni
rompipalle roohetnak rosebuds rosypalm rosypalmandher5sisters rosypalmandherefivesisters rothoer rotzak roubignole
roundeye roundeyes roupette rov rovhal rovknulla rtard rtards ruchac ruffiano rukhond rukken rulacho rumprammer runka
runkata runkkari runkkaus runkku ruski russki russkie rustytrombone ryssa rzygac s0b saala saalakutta saalikutti
saalirandi saatanasti sabandija sacafoutre sacamerde sacamuelas sacanagem sadico sadis sadism sadist sadom safada safado
saintchreme saintciboire saintcreme saintsacrament saintsimonaque saksocu saksocuda saksocudan saksocular saksoculara
saksocularda saksoculardan saksocunun saksocuya saksocuyu salaud salgot salopard salope sambo sambos
samckdaddy samere sandm sandnigger sandniggers sanguijuela sanscouilles santorum sapatao sarce sardegnola sardegnolo
sattapa sausagequeen sauteaupaf sbattersi sbocchinara sbocchinare sbocchinari sbocchinaro sbocchini sbocchino sbora
sboro sborona sborone sborra sborrare sborrata sborrate sborro sborrone sbrodolata sburra sburrata sburrate sburrati
sburrato sburro scacazza scacazzando scacazzano scacazzare scacazzata scacazzate scacazzi scacazziamo scacazzo scag
scagazza scagazzando scagazzano scagazzare scagazzata scagazzate scagazzi scagazziamo scagazzo scallywag scank scantily
scappella scappellamenti scappellamento scappellano scappellare scappellata scappellate scappellati scappellato
scassacazzi scassacazzo scassaminchia scassapalle scat scazza scazzando scazzano scazzare scazzata scazzate scazzati
scazzato scazzi scazziamo scazzo scema scemata scemate sceme scemi scemo schabracke schaffer schatje scheiss scheisse
scheisser schiappa schiappe schiesser schijt schijten schizo schlampe schleu schlong schnackeln schnek schoft
schuinsmarcheerder schvartse schvartsen schwanzlutscher schwartze schwartzen schwuchtel scissoring scoglionamento
scoglionandosi scoglionare scoglionarsi scoglionata scoglionate scoglionati scoglionato scopamica scopamiche scopamici
scopamico scopare scopata scopati scoreggia scoreggiare scorreggia scorreggiare screwyou scroat scrog scrotale scrote
scroti scroto scrotum scrud sculata sculate sculati sculato sebatsya sebattrelescouillesde sebranlerlescouilles
secalisser secasserlagueule secasserlecul secasserlescouilles secasserletronc secchiona secchione secchioni
secirerlemanche secogner secontrecrisser secontrefoutre sedesenclaverlapeninsule sedoigter sefaireenculer
sefairelabite sefairepousseraucul sefairereluire sefoutrede sefoutredelagueulede segaiola segaiole segaioli
segaiolo segarsi segelerlecroupion segelerlefion segelerlescouilles segg seggek seggeket segget seggfej seggfejek
seggfejeket seggfejet segone segoni selescailler semagnerlecul semangerlescouilles semen senos sentlapisse seppo seppos
septics serongerleculalavinaigrette sesortirlesdoigtsducul setaper setaperunequeue seviderlescouilles sex sexcam sexed
sexfarm sexhound sexhouse sexi sexing sexkitten sexo sexooral sexpot sexslave sextogo sextoy sextoys sexwhore sexx sexxi
sexxx sexxxi sexxxy sexxy sexymoma sexyslim sfigare sfigata sfigate sfigati sfigato sgrillettando sgrillettano
sgrillettare sgrillettarsi sgrillettata sgrillettate sgrillettati sgrillettato sh1t sh1ter sh1ts sh1tter sh1tz shag
shagger shaggin shagging shahwa shalaga shalava shamedame shanbora sharag sharameet sharmoot sharmoota sharmot sharmota
sharmuta sharmute shat shav shavedbeaver shavedpussy shawtypimp shayet shayta shaz sheeney sheikha shemale shhit
shibari shibary shiksa shinola shipal shit shitass shitbag shitbagger shitblimp shitbrain shitbreath shitcan shitcunt
shitdick shite shiteater shiteating shited shitey shitface shitfaced shitfit shitforbrains shitfuck shitfucker shitfull
shithapens shithappens shithead shitheel shithole shithouse shiting shitings shitlist shitload shitola shitoutofluck
shitpot shits shitspitter shitstain shitt shitted shitter shitters shittiest shitting shittings shitty shity shitz shiz
shiznit shortfuck shota shrimping shylock shylocks shyt shyte shytty shyty sik sike sikersikmez siki sikilirsikilmez
sikin sikler siklerde siklerden siklere sikleri siklerin sikmek sikmemek sikte sikten siktir siktirirsiktirmez simonaque
simp sinentraero singar sinnsykt sinsustancia siririca sissy sixsixsix sixtynine sixtyniner skag skaggbiff skanck skank
skankbitch skankee skankey skankfuck skanks skankwhore skanky skankybitch skankywhore skayrey skayreyya skeet skinflute
skita skitnerdig skitt skribz skullfuck skum skumbag skurwysyn skwa skwe slabbrata slabbratamadonna slabbrato slag
slanteye slanty slapper slave slavedriver sleezebag sleezeball slempen slet sletterig slideitin slikmijnzaad slimeball
slimebucket slinguano slinguare slinguata slinguate slinguati slinguato slopehead slopeheads sloper slopers slopey
slopeys slopies slopy slut slutbag slutbucket slutdumper slutkiss sluts slutt slutting slutty slutwear slutwhore slutz
smackthemonkey smandrappano smandrappata smandrappate smandrappati smandrappato smeg smegma smerda smerdando smerdare
smerdata smerdato smut smutty snatch snatchpatch snedfitta snefitta sniggered sniggering sniggers snol snowback
snowballing snownigger snuff so7ak so7akeyya sobarsela sobisa sobo soccia soccmel socksucker socmel sodom sodomise
sodomita sodomite sodomiti sodomize sodomy soffocotti soffocotto sonajas sonofabitch sonofawhore sonofbitch sonso
sooties sooty sopladores soplagaitas soplaguindas soplanucas soplapollas sorca sorce sorcia sorete sorm sormaha sormak
sosco souchien souchienne souse soused sousmerde soustat sowa soyboy spac spaccamaroni spaccamarroni spaghettibender
spaghettinigger spank spankthemonkey spastic spearchucker spearchuckers sperm sperma spermacide spermbag spermhearder
spermherder sphencter sphincter spic spick spicks spics spierdalaj spig spigotty spik spiks spitter splittail splooge
sploogemoose spludge spompina spompinando spompinao spompinara spompinare spompinari spompinaro spompinata spompinate
spompinati spompinato spompini spompino spontchi spooge spreadeagle spreadlegs spuiten spunk spunky sputtanando
sputtanano sputtanare sputtanate sputtani sqeh squa squarehead squareheads squaw squinty squinzia squinzie squirting
srac sracka sraczka srat ssossi stagg standje standje69 stapikk stapikkene stapikker stfu sticazzi sticchio stiffy
stocazzo stoephoer stoner stootje strapon strappado stripclub stront stronza stronzaggine stronzaggini
stronzata stronzate stronze stronzeggiare stronzetta stronzette stronzetti stronzetto stronzi stronzo stronzodio
stronzone stronzoni stuinties stupid stupidfuck stupidfucker styervo styledoggy suarkelund suarkiaulad subba suca
sucando sucano sucanti sucare sucate sucato succhiacazzi succhiacazzo succhiami succhione suce suceboules
sucemedailles sucer suceuse suck suckdick sucked sucker sucking suckme suckmyass suckmydick suckmytit suckoff sucks
sufferd suicidegirl suicidegirls suine suinodio suka sukinsyn suklaaosasto sulin sultrywoman sultrywomen
sumofabiatch svartheiteste sveltina sveltine svergina sverginando sverginano sverginare sverginata sverginate sverginati
sverginato svoditposrat svoloch swallower swalow swampguinea swampguineas swastika swinger syf syphilis szajha szajhak
szajhakat szajhat szar szarabb szarik szarok szarokat szart t1t t1tt1e5 t1tties ta77an tabarnac tabarnak tabon tabonak
tabonek taboon taboonak taboonek tabouche taboune tacohead tacoheads tafiole tagarote tagueule taheccunt tahhan
taintedlove tajarse takeoffyour tamere tamerelapute tanate tanche tanga tangina tantouze tapette tapettitude tapijtnek
tapiole tarada tarado tarbabies tarbaby tarlouze tarma tartissure tarugo tarzanelli tarzanello tasaga tasak tasaklar
tasaklara tasaklarda tasaklardan tasakta tasaktan taspe tassepe tastemy tatte tatti tavara tawdry taxna teabagging
teat techa teef teets teez teezak teezha teezhom teezo tega teghe tegona tegone telephonerauxcongolais telhasrasairi
temeier tepu terd tereso terga terghe terimaakabhosada terimaakabobachusu terimaakibehenchod terimaakichut teringlijer
terma terrona terrone terroni terronia terrun testadicazzo testadimerda testedicazzo testedimerda testical testicle
testicles testicoli testicolo testis tetas tetasgrandes tetedegland tetedenoeud tetta tettata tettate tette tettina
tettine tettona tettone teub teuch teucha tezak tezao tezuda tezudo tharak tharki thicklip thicklips thirdeye thirdleg
threesome threeway throating thumbzilla thundercunt tiabuena tiedup tightwhite tigolbitties tigoldbitties timbernigger
timberniggers tinkers tiralevitas tireaucul tirersoncoup tireruncoup tirica tit titbitnipply titfuck titfucker titfuckin
titjob titlicker titlover tits titt tittchen titten tittie tittie5 tittiefucker titties tittis titty tittyfuck
tittyfucker tittys tittywank titwank tity tkaffat toba tocapelotas tocho toeter tolai tolete tompeates tomurder
tongethruster tongueina tonguethrust tonguetramp tongzoeng tontaco tontucio toosa toots topless tordo tortillera tortur
torture tosser totona toutdelagueule towelhead towelheads tr00n tr00ns tragaldabas tragasables trailertrash trakhatsya
trannie tranny transar transsexual transvestite treuf tribadism trimandoblydskiypizdoproyob trincar tringler triootjeg
triplex trique trisexual trocha troia troiaio troiamadonna troiata troiate troiona troione troioni trola trolo
trombamica trombamiche trombamici trombamico trombando trombano trombare trombata trombate trombati trombato trombi
troncher troon troons trots trottoirprostituee trottoirteef troucha troudeballe troudecul trouduc trouducul
trouduculdumonde trouducune trouerlecul troufignoler troufignolerie troufignoliser troufignon trouxa troxa tteqqun
tteqqunt tubgirl tuchuda tuckahoe tuercebotas tuhkaluukku tumputtaa tunante tunneloflove turdburgler turluchon turlute
turlutte turnon turpasauna tusan tush tushy tussu tussukka tussut tw4t twat twathead twatlips twats twatty twatwaffle
twink twinkie twobitwhore twogirlsonecup twunt twunter ublyudok uboy uccella uccellone uccelloni uck udgepacker
uebitsche ukrop ulol unclefucker uncletom undressing unfuckable upskirt uptheass upthebutt uqan urethraplay urophilia
usama ussys uzi v14gra v1gra v4gra va1jina vaccamadonna vaccona vaccone vachier vadia vaffanculo vafla vaflilovit vag
vag1na vagabunda vagabundo vagaranha vagiina vagina vaginale vagine vaiafareinculo vaisliberermandela vaitefoder
vaitomarnocu vaj1na vajina vajj vakipano valiberermandela valium vangare vaniquertamere vatefaireempapaouter
vatefaireenculer vatefairefoutre vatefairemettre vatteneaffanculo vdm veada veadao veado vendredupiment venusmound verga
vergallen vergallito vergallo verkloten verneuken vetaakateen vetealamierda vgra viada viadao viadinho viado viagra
viarge vibr vibrador vibrater vibrator viespeuk vigra viiksi vingeren violador violar violetwand virginbreaker vittu
vittuilla vittuilu vittumainen vittuuntua vittuuntunut vitun vitusti vituttaa vitutus vixen vjayjay vleesroos vogeln
volarse vollpfosten voltearselarosca voltearselatortilla vomit voorjanlul voorjanmetdekorteachternaam vorarephilia
voyeur voyeurweb voyuer vpizdu vtff vullva vulva vulve vulvetta vulvette vyperdysh vypicenec vzdrochennyi w00se w0p w3ra
wa3ra wab wank wanker wanking wanky watje waysted wazoo weenie weewee welzijnsmafia wench wetb wetback wetbacks wetdream
wetspot wh00r wh0re wh0reface whacker whash whigger whiggers whiskeydick whiskydick whitenigger whitepower whitetrash
whitey whiteys whities whiz whoar whop whoralicious whore whorealicious whorebag whored whoreface whorefucker
whorehopper whorehouse whores whoring wichse wichsen wichser wigga wiggas wigger wiggers wijf willies williewanker
wippen wkurwiac wog wogs woose wop worldsex wrappingmen wrinkledstarfish wtf wuftje wuss wuzzie xavasca xereca xerereca
xexeca xkwe xochota xota xoxota xrated xrated2g1c xtc xxx xxxxxx yaoi yaraga yarak yaraklar yaraklara yaraklarda
yaraklardan yarakta yaraktan yarpie yarpies yavoirunecouilledanslepate yavoirunecouilledanslepotage yebvas yed
yellowman yellowshowers yeule yid yids yiffy yobbo youp youpin youpine yourboobs yourpenis yourtits yury zaadje zaaka
zabbour zabourah zacomak zaebat zaebis zaghnaboot zajebisty zakkenwasser zakomak zalupa zalupat zamacuco zambombo
zamenfek zampabollos zamugo zanboor zarrapastroso zascandil zasranetc zassat zboob zboube zebak zebala zebedei zebedeo
zeby zeg zega zegg zegga zeiken zeiker zguegue zigabo zigabos zigounette zinna zinne zinnona zinnone ziocantante zippak
zipperhead zipperheads zippy zizi zkurvit zkurvysyn zloebuchy zmrd zobr zobrak zobry zoccola zoccole zoccoletta
zoccolette zoccolona zoccolone zoophile zoophilia zopenco zoquete zorra zote zrat zuigen zuiplap zullenco zurcefrenillos
zwamel
`.split(/\s+/).filter(Boolean));
