import { assert } from "./indexed-helpers";
import { randomBytes as randomBytesNode } from "crypto";

export { Poseidon };

function assertPositiveInteger(n: number, message: string) {
  if (!Number.isInteger(n) || n <= 0) throw Error(message);
}

type PoseidonParameters = {
  fullRounds: number;
  partialRounds: number;
  hasInitialRoundConstant: boolean;
  stateSize: number;
  rate: number;
  power: number;
  roundConstants: string[][];
  mds: string[][];
};

function fieldToGroup(x: bigint) {
  const { potentialXs, tryDecode } = GroupMapPallas;
  const xs = potentialXs(x);
  return xs.map((x: any) => tryDecode(x)).find((x: any) => x);
}

function makeHashToGroup(hash: (i: bigint[]) => bigint) {
  return (input: bigint[]) => {
    let digest = hash(input);
    let g = fieldToGroup(digest);
    if (g === undefined) return undefined;

    // the y coordinate is calculated using a square root, so it has two possible values
    // to make the output deterministic, we negate y if it is odd
    // we do the same in-snark, so both APIs match
    let isOdd = (g.y & 1n) === 1n;
    let y = isOdd ? Fp.negate(g.y) : g.y;
    return { x: g.x, y };
  };
}

function createPoseidon(
  Fp: FiniteField,
  {
    fullRounds,
    partialRounds,
    hasInitialRoundConstant,
    stateSize,
    rate,
    power: power_,
    roundConstants: roundConstants_,
    mds: mds_,
  }: PoseidonParameters
) {
  if (partialRounds !== 0) {
    throw Error("we don't support partial rounds");
  }
  assertPositiveInteger(rate, "rate must be a positive integer");
  assertPositiveInteger(fullRounds, "fullRounds must be a positive integer");
  assertPositiveInteger(power_, "power must be a positive integer");
  let power = BigInt(power_);
  let roundConstants = roundConstants_.map((arr) => arr.map(BigInt));
  let mds = mds_.map((arr) => arr.map(BigInt));

  function initialState(): bigint[] {
    return Array(stateSize).fill(0n);
  }

  function hash(input: bigint[]) {
    let state = update(initialState(), input);
    return state[0];
  }

  function update([...state]: bigint[], input: bigint[]) {
    // special case for empty input
    if (input.length === 0) {
      permutation(state);
      return state;
    }
    // pad input with zeros so its length is a multiple of the rate
    let n = Math.ceil(input.length / rate) * rate;
    input = input.concat(Array(n - input.length).fill(0n));
    // for every block of length `rate`, add block to the first `rate` elements of the state, and apply the permutation
    for (let blockIndex = 0; blockIndex < n; blockIndex += rate) {
      for (let i = 0; i < rate; i++) {
        state[i] = Fp.add(state[i], input[blockIndex + i]);
      }
      permutation(state);
    }
    return state;
  }

  /**
   * Standard Poseidon (without "partial rounds") goes like this:
   *
   *    ARK_0 -> SBOX -> MDS
   * -> ARK_1 -> SBOX -> MDS
   * -> ...
   * -> ARK_{rounds - 1} -> SBOX -> MDS
   *
   * where all computation operates on a vector of field elements, the "state", and
   * - ARK  ... add vector of round constants to the state, element-wise (different vector in each round)
   * - SBOX ... raise state to a power, element-wise
   * - MDS  ... multiply the state by a constant matrix (same matrix every round)
   * (these operations are done modulo p of course)
   *
   * For constraint efficiency reasons, in Mina's implementation the first round constant addition is left out
   * and is done at the end instead, so that effectively the order of operations in each iteration is rotated:
   *
   *    SBOX -> MDS -> ARK_0
   * -> SBOX -> MDS -> ARK_1
   * -> ...
   * -> SBOX -> MDS -> ARK_{rounds - 1}
   *
   * If `hasInitialRoundConstant` is true, another ARK step is added at the beginning.
   *
   * See also Snarky.Sponge.Poseidon.block_cipher
   */
  function permutation(state: bigint[]) {
    // special case: initial round constant
    let offset = 0;
    if (hasInitialRoundConstant) {
      for (let i = 0; i < stateSize; i++) {
        state[i] = Fp.add(state[i], roundConstants[0][i]);
      }
      offset = 1;
    }
    for (let round = 0; round < fullRounds; round++) {
      // raise to a power
      for (let i = 0; i < stateSize; i++) {
        state[i] = Fp.power(state[i], power);
      }
      let oldState = [...state];
      for (let i = 0; i < stateSize; i++) {
        // multiply by mds matrix
        state[i] = Fp.dot(mds[i], oldState);
        // add round constants
        state[i] = Fp.add(state[i], roundConstants[round + offset][i]);
      }
    }
  }

  return { initialState, update, hash };
}

let poseidonParamsKimchiFp = {
  mds: [
    [
      "12035446894107573964500871153637039653510326950134440362813193268448863222019",
      "25461374787957152039031444204194007219326765802730624564074257060397341542093",
      "27667907157110496066452777015908813333407980290333709698851344970789663080149",
    ],
    [
      "4491931056866994439025447213644536587424785196363427220456343191847333476930",
      "14743631939509747387607291926699970421064627808101543132147270746750887019919",
      "9448400033389617131295304336481030167723486090288313334230651810071857784477",
    ],
    [
      "10525578725509990281643336361904863911009900817790387635342941550657754064843",
      "27437632000253211280915908546961303399777448677029255413769125486614773776695",
      "27566319851776897085443681456689352477426926500749993803132851225169606086988",
    ],
  ],
  roundConstants: [
    [
      "21155079691556475130150866428468322463125560312786319980770950159250751855431",
      "16883442198399350202652499677723930673110172289234921799701652810789093522349",
      "17030687036425314703519085065002231920937594822150793091243263847382891822670",
    ],
    [
      "25216718237129482752721276445368692059997901880654047883630276346421457427360",
      "9054264347380455706540423067244764093107767235485930776517975315876127782582",
      "26439087121446593160953570192891907825526260324480347638727375735543609856888",
    ],
    [
      "15251000790817261169639394496851831733819930596125214313084182526610855787494",
      "10861916012597714684433535077722887124099023163589869801449218212493070551767",
      "18597653523270601187312528478986388028263730767495975370566527202946430104139",
    ],
    [
      "15831416454198644276563319006805490049460322229057756462580029181847589006611",
      "15171856919255965617705854914448645702014039524159471542852132430360867202292",
      "15488495958879593647482715143904752785889816789652405888927117106448507625751",
    ],
    [
      "19039802679983063488134304670998725949842655199289961967801223969839823940152",
      "4720101937153217036737330058775388037616286510783561045464678919473230044408",
      "10226318327254973427513859412126640040910264416718766418164893837597674300190",
    ],
    [
      "20878756131129218406920515859235137275859844638301967889441262030146031838819",
      "7178475685651744631172532830973371642652029385893667810726019303466125436953",
      "1996970955918516145107673266490486752153434673064635795711751450164177339618",
    ],
    [
      "15205545916434157464929420145756897321482314798910153575340430817222504672630",
      "25660296961552699573824264215804279051322332899472350724416657386062327210698",
      "13842611741937412200312851417353455040950878279339067816479233688850376089318",
    ],
    [
      "1383799642177300432144836486981606294838630135265094078921115713566691160459",
      "1135532281155277588005319334542025976079676424839948500020664227027300010929",
      "4384117336930380014868572224801371377488688194169758696438185377724744869360",
    ],
    [
      "21725577575710270071808882335900370909424604447083353471892004026180492193649",
      "676128913284806802699862508051022306366147359505124346651466289788974059668",
      "25186611339598418732666781049829183886812651492845008333418424746493100589207",
    ],
    [
      "10402240124664763733060094237696964473609580414190944671778761753887884341073",
      "11918307118590866200687906627767559273324023585642003803337447146531313172441",
      "16895677254395661024186292503536662354181715337630376909778003268311296637301",
    ],
    [
      "23818602699032741669874498456696325705498383130221297580399035778119213224810",
      "4285193711150023248690088154344086684336247475445482883105661485741762600154",
      "19133204443389422404056150665863951250222934590192266371578950735825153238612",
    ],
    [
      "5515589673266504033533906836494002702866463791762187140099560583198974233395",
      "11830435563729472715615302060564876527985621376031612798386367965451821182352",
      "7510711479224915247011074129666445216001563200717943545636462819681638560128",
    ],
    [
      "24694843201907722940091503626731830056550128225297370217610328578733387733444",
      "27361655066973784653563425664091383058914302579694897188019422193564924110528",
      "21606788186194534241166833954371013788633495786419718955480491478044413102713",
    ],
    [
      "19934060063390905409309407607814787335159021816537006003398035237707924006757",
      "8495813630060004961768092461554180468161254914257386012937942498774724649553",
      "27524960680529762202005330464726908693944660961000958842417927307941561848461",
    ],
    [
      "15178481650950399259757805400615635703086255035073919114667254549690862896985",
      "16164780354695672259791105197274509251141405713012804937107314962551600380870",
      "10529167793600778056702353412758954281652843049850979705476598375597148191979",
    ],
    [
      "721141070179074082553302896292167103755384741083338957818644728290501449040",
      "22044408985956234023934090378372374883099115753118261312473550998188148912041",
      "27068254103241989852888872162525066148367014691482601147536314217249046186315",
    ],
    [
      "3880429241956357176819112098792744584376727450211873998699580893624868748961",
      "17387097125522937623262508065966749501583017524609697127088211568136333655623",
      "6256814421247770895467770393029354017922744712896100913895513234184920631289",
    ],
    [
      "2942627347777337187690939671601251987500285937340386328746818861972711408579",
      "24031654937764287280548628128490074801809101323243546313826173430897408945397",
      "14401457902976567713827506689641442844921449636054278900045849050301331732143",
    ],
    [
      "20170632877385406450742199836933900257692624353889848352407590794211839130727",
      "24056496193857444725324410428861722338174099794084586764867109123681727290181",
      "11257913009612703357266904349759250619633397075667824800196659858304604714965",
    ],
    [
      "22228158921984425749199071461510152694025757871561406897041788037116931009246",
      "9152163378317846541430311327336774331416267016980485920222768197583559318682",
      "13906695403538884432896105059360907560653506400343268230130536740148070289175",
    ],
    [
      "7220714562509721437034241786731185291972496952091254931195414855962344025067",
      "27608867305903811397208862801981345878179337369367554478205559689592889691927",
      "13288465747219756218882697408422850918209170830515545272152965967042670763153",
    ],
    [
      "8251343892709140154567051772980662609566359215743613773155065627504813327653",
      "22035238365102171608166944627493632660244312563934708756134297161332908879090",
      "13560937766273321037807329177749403409731524715067067740487246745322577571823",
    ],
    [
      "21652518608959234550262559135285358020552897349934571164032339186996805408040",
      "22479086963324173427634460342145551255011746993910136574926173581069603086891",
      "13676501958531751140966255121288182631772843001727158043704693838707387130095",
    ],
    [
      "5680310394102577950568930199056707827608275306479994663197187031893244826674",
      "25125360450906166639190392763071557410047335755341060350879819485506243289998",
      "22659254028501616785029594492374243581602744364859762239504348429834224676676",
    ],
    [
      "23101411405087512171421838856759448177512679869882987631073569441496722536782",
      "24149774013240355952057123660656464942409328637280437515964899830988178868108",
      "5782097512368226173095183217893826020351125522160843964147125728530147423065",
    ],
    [
      "13540762114500083869920564649399977644344247485313990448129838910231204868111",
      "20421637734328811337527547703833013277831804985438407401987624070721139913982",
      "7742664118615900772129122541139124149525273579639574972380600206383923500701",
    ],
    [
      "1109643801053963021778418773196543643970146666329661268825691230294798976318",
      "16580663920817053843121063692728699890952505074386761779275436996241901223840",
      "14638514680222429058240285918830106208025229459346033470787111294847121792366",
    ],
    [
      "17080385857812672649489217965285727739557573467014392822992021264701563205891",
      "26176268111736737558502775993925696791974738793095023824029827577569530708665",
      "4382756253392449071896813428140986330161215829425086284611219278674857536001",
    ],
    [
      "13934033814940585315406666445960471293638427404971553891617533231178815348902",
      "27054912732979753314774418228399230433963143177662848084045249524271046173121",
      "28916070403698593376490976676534962592542013020010643734621202484860041243391",
    ],
    [
      "24820015636966360150164458094894587765384135259446295278101998130934963922381",
      "7969535238488580655870884015145760954416088335296905520306227531221721881868",
      "7690547696740080985104189563436871930607055124031711216224219523236060212249",
    ],
    [
      "9712576468091272384496248353414290908377825697488757134833205246106605867289",
      "12148698031438398980683630141370402088785182722473169207262735228500190477924",
      "14359657643133476969781351728574842164124292705609900285041476162075031948227",
    ],
    [
      "23563839965372067275137992801035780013422228997724286060975035719045352435470",
      "4184634822776323233231956802962638484057536837393405750680645555481330909086",
      "16249511905185772125762038789038193114431085603985079639889795722501216492487",
    ],
    [
      "11001863048692031559800673473526311616702863826063550559568315794438941516621",
      "4702354107983530219070178410740869035350641284373933887080161024348425080464",
      "23751680507533064238793742311430343910720206725883441625894258483004979501613",
    ],
    [
      "28670526516158451470169873496541739545860177757793329093045522432279094518766",
      "3568312993091537758218792253361873752799472566055209125947589819564395417072",
      "1819755756343439646550062754332039103654718693246396323207323333948654200950",
    ],
    [
      "5372129954699791301953948907349887257752247843844511069896766784624930478273",
      "17512156688034945920605615850550150476471921176481039715733979181538491476080",
      "25777105342317622165159064911913148785971147228777677435200128966844208883059",
    ],
    [
      "25350392006158741749134238306326265756085455157012701586003300872637887157982",
      "20096724945283767296886159120145376967480397366990493578897615204296873954844",
      "8063283381910110762785892100479219642751540456251198202214433355775540036851",
    ],
    [
      "4393613870462297385565277757207010824900723217720226130342463666351557475823",
      "9874972555132910032057499689351411450892722671352476280351715757363137891038",
      "23590926474329902351439438151596866311245682682435235170001347511997242904868",
    ],
    [
      "17723373371137275859467518615551278584842947963894791032296774955869958211070",
      "2350345015303336966039836492267992193191479606566494799781846958620636621159",
      "27755207882790211140683010581856487965587066971982625511152297537534623405016",
    ],
    [
      "6584607987789185408123601849106260907671314994378225066806060862710814193906",
      "609759108847171587253578490536519506369136135254150754300671591987320319770",
      "28435187585965602110074342250910608316032945187476441868666714022529803033083",
    ],
    [
      "16016664911651770663938916450245705908287192964254704641717751103464322455303",
      "17551273293154696089066968171579395800922204266630874071186322718903959339163",
      "20414195497994754529479032467015716938594722029047207834858832838081413050198",
    ],
    [
      "19773307918850685463180290966774465805537520595602496529624568184993487593855",
      "24598603838812162820757838364185126333280131847747737533989799467867231166980",
      "11040972566103463398651864390163813377135738019556270484707889323659789290225",
    ],
    [
      "5189242080957784038860188184443287562488963023922086723850863987437818393811",
      "1435203288979376557721239239445613396009633263160237764653161500252258220144",
      "13066591163578079667911016543985168493088721636164837520689376346534152547210",
    ],
    [
      "17345901407013599418148210465150865782628422047458024807490502489711252831342",
      "22139633362249671900128029132387275539363684188353969065288495002671733200348",
      "1061056418502836172283188490483332922126033656372467737207927075184389487061",
    ],
    [
      "10241738906190857416046229928455551829189196941239601756375665129874835232299",
      "27808033332417845112292408673209999320983657696373938259351951416571545364415",
      "18820154989873674261497645724903918046694142479240549687085662625471577737140",
    ],
    [
      "7983688435214640842673294735439196010654951226956101271763849527529940619307",
      "17067928657801807648925755556866676899145460770352731818062909643149568271566",
      "24472070825156236829515738091791182856425635433388202153358580534810244942762",
    ],
    [
      "25752201169361795911258625731016717414310986450004737514595241038036936283227",
      "26041505376284666160132119888949817249574689146924196064963008712979256107535",
      "23977050489096115210391718599021827780049209314283111721864956071820102846008",
    ],
    [
      "26678257097278788410676026718736087312816016749016738933942134600725962413805",
      "10480026985951498884090911619636977502506079971893083605102044931823547311729",
      "21126631300593007055117122830961273871167754554670317425822083333557535463396",
    ],
    [
      "1564862894215434177641156287699106659379648851457681469848362532131406827573",
      "13247162472821152334486419054854847522301612781818744556576865965657773174584",
      "8673615954922496961704442777870253767001276027366984739283715623634850885984",
    ],
    [
      "2794525076937490807476666942602262298677291735723129868457629508555429470085",
      "4656175953888995612264371467596648522808911819700660048695373348629527757049",
      "23221574237857660318443567292601561932489621919104226163978909845174616477329",
    ],
    [
      "1878392460078272317716114458784636517603142716091316893054365153068227117145",
      "2370412714505757731457251173604396662292063533194555369091306667486647634097",
      "17409784861870189930766639925394191888667317762328427589153989811980152373276",
    ],
    [
      "25869136641898166514111941708608048269584233242773814014385564101168774293194",
      "11361209360311194794795494027949518465383235799633128250259863567683341091323",
      "14913258820718821235077379851098720071902170702113538811112331615559409988569",
    ],
    [
      "12957012022018304419868287033513141736995211906682903915897515954290678373899",
      "17128889547450684566010972445328859295804027707361763477802050112063630550300",
      "23329219085372232771288306767242735245018143857623151155581182779769305489903",
    ],
    [
      "1607741027962933685476527275858938699728586794398382348454736018784568853937",
      "2611953825405141009309433982109911976923326848135736099261873796908057448476",
      "7372230383134982628913227482618052530364724821976589156840317933676130378411",
    ],
    [
      "20203606758501212620842735123770014952499754751430660463060696990317556818571",
      "4678361398979174017885631008335559529633853759463947250620930343087749944307",
      "27176462634198471376002287271754121925750749676999036165457559387195124025594",
    ],
    [
      "6361981813552614697928697527332318530502852015189048838072565811230204474643",
      "13815234633287489023151647353581705241145927054858922281829444557905946323248",
      "10888828634279127981352133512429657747610298502219125571406085952954136470354",
    ],
  ],
  fullRounds: 55,
  partialRounds: 0,
  hasInitialRoundConstant: false,
  stateSize: 3,
  rate: 2,
  power: 7,
};

// CONSTANTS

// the modulus. called `p` in most of our code.
const p = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const q = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;

// this is `t`, where p = 2^32 * t + 1
const pMinusOneOddFactor =
  0x40000000000000000000000000000000224698fc094cf91b992d30edn;
const qMinusOneOddFactor =
  0x40000000000000000000000000000000224698fc0994a8dd8c46eb21n;

// primitive roots of unity, computed as (5^t mod p). this works because 5 generates the multiplicative group mod p
const twoadicRootFp =
  0x2bce74deac30ebda362120830561f81aea322bf2b7bb7584bdad6fabd87ea32fn;
const twoadicRootFq =
  0x2de6a9b8746d3f589e5c4dfd492ae26e9bb97ea3c106f049a70e2c1102b6d05fn;

const Fp = createField(p, {
  oddFactor: pMinusOneOddFactor,
  twoadicRoot: twoadicRootFp,
  twoadicity: 32n,
});

type FiniteField = ReturnType<typeof createField>;

function randomBytes(n: number) {
  return new Uint8Array(randomBytesNode(n));
}

/**
 * Compute constants to instantiate a finite field just from the modulus
 */
function computeFieldConstants(p: bigint) {
  // figure out the factorization p - 1 = 2^M * t
  let oddFactor = p - 1n;
  let twoadicity = 0n;
  while ((oddFactor & 1n) === 0n) {
    oddFactor >>= 1n;
    twoadicity++;
  }

  // find z = non-square
  // start with 2 and increment until we find one
  let z = 2n;
  while (isSquare(z, p)) z++;

  // primitive root of unity is z^t
  let twoadicRoot = power(z, oddFactor, p);

  return { oddFactor, twoadicRoot, twoadicity };
}

/**
 * ceil(log2(n))
 * = smallest k such that n <= 2^k
 */
function log2(n: number | bigint) {
  if (typeof n === "number") n = BigInt(n);
  if (n === 1n) return 0;
  return (n - 1n).toString(2).length;
}

function createField(
  p: bigint,
  constants?: { oddFactor: bigint; twoadicRoot: bigint; twoadicity: bigint }
) {
  let { oddFactor, twoadicRoot, twoadicity } =
    constants ?? computeFieldConstants(p);
  let sizeInBits = log2(p);
  let sizeInBytes = Math.ceil(sizeInBits / 8);
  let sizeHighestByte = sizeInBits - 8 * (sizeInBytes - 1);
  let hiBitMask = (1 << sizeHighestByte) - 1;

  // parameters for fast inverse
  const w = 31;
  const n = Math.ceil(sizeInBits / w);
  const kmax = BigInt(2 * n * w);

  // constant for correcting 2^k/x -> 1/x, by multiplying with 2^-kmax * 2^(kmax - k)
  const twoToMinusKmax = inverse(1n << kmax, p);
  const exportedInverse =
    twoToMinusKmax !== undefined
      ? (x: bigint) => fastInverse(x, p, n, kmax, twoToMinusKmax)
      : (x: bigint) => inverse(x, p);

  return {
    modulus: p,
    sizeInBits,
    t: oddFactor,
    M: twoadicity,
    twoadicRoot,
    mod(x: bigint) {
      return mod(x, p);
    },
    add(x: bigint, y: bigint) {
      return mod(x + y, p);
    },
    not(x: bigint, bits: number) {
      return mod(2n ** BigInt(bits) - (x + 1n), p);
    },
    negate(x: bigint) {
      return x === 0n ? 0n : p - x;
    },
    sub(x: bigint, y: bigint) {
      return mod(x - y, p);
    },
    mul(x: bigint, y: bigint) {
      return mod(x * y, p);
    },
    inverse: exportedInverse,
    div(x: bigint, y: bigint) {
      let yinv = exportedInverse(y);
      if (yinv === undefined) return;
      return mod(x * yinv, p);
    },
    square(x: bigint) {
      return mod(x * x, p);
    },
    isSquare(x: bigint) {
      return isSquare(x, p);
    },
    sqrt(x: bigint) {
      return sqrt(x, p, oddFactor, twoadicRoot, twoadicity);
    },
    power(x: bigint, n: bigint) {
      return power(x, n, p);
    },
    dot(x: bigint[], y: bigint[]) {
      let z = 0n;
      let n = x.length;
      for (let i = 0; i < n; i++) {
        z += x[i] * y[i];
      }
      return mod(z, p);
    },
    equal(x: bigint, y: bigint) {
      return mod(x - y, p) === 0n;
    },
    isEven(x: bigint) {
      return !(x & 1n);
    },
    random() {
      return randomField(p, sizeInBytes, hiBitMask);
    },
    fromNumber(x: number) {
      return mod(BigInt(x), p);
    },
    fromBigint(x: bigint) {
      return mod(x, p);
    },
    rot(
      x: bigint,
      bits: bigint,
      direction: "left" | "right" = "left",
      maxBits = 64n
    ) {
      if (direction === "right") bits = maxBits - bits;
      let full = x << bits;
      let excess = full >> maxBits;
      let shifted = full & ((1n << maxBits) - 1n);
      return shifted | excess;
    },
    leftShift(x: bigint, bits: number, maxBitSize: number = 64) {
      let shifted = x << BigInt(bits);
      return shifted & ((1n << BigInt(maxBitSize)) - 1n);
    },
    rightShift(x: bigint, bits: number) {
      return x >> BigInt(bits);
    },
  };
}

function mod(x: bigint, p: bigint) {
  x = x % p;
  if (x < 0) return x + p;
  return x;
}

// modular exponentiation, a^n % p
function power(a: bigint, n: bigint, p: bigint) {
  a = mod(a, p);
  let x = 1n;
  for (; n > 0n; n >>= 1n) {
    if (n & 1n) x = mod(x * a, p);
    a = mod(a * a, p);
  }
  return x;
}

// inverting with EGCD, 1/a in Z_p
function inverse(a: bigint, p: bigint) {
  a = mod(a, p);
  if (a === 0n) return undefined;
  let b = p;
  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;
  while (a !== 0n) {
    let q = b / a;
    let r = mod(b, a);
    let m = x - u * q;
    let n = y - v * q;
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  if (b !== 1n) return undefined;
  return mod(x, p);
}

// faster inversion algorithm based on
// Thomas Pornin, "Optimized Binary GCD for Modular Inversion", https://eprint.iacr.org/2020/972.pdf
// about 3x faster than `inverse()`
function fastInverse(
  x: bigint,
  p: bigint,
  n: number,
  kmax: bigint,
  twoToMinusKmax: bigint
) {
  x = mod(x, p);
  if (x === 0n) return undefined;

  // fixed constants
  const w = 31;
  const hiBits = 31;
  const wn = BigInt(w);
  const wMask = (1n << wn) - 1n;

  let u = p;
  let v = x;
  let r = 0n;
  let s = 1n;

  let i = 0;

  for (; i < 2 * n; i++) {
    let f0 = 1;
    let g0 = 0;
    let f1 = 0;
    let g1 = 1;

    let ulo = Number(u & wMask);
    let vlo = Number(v & wMask);

    let len = Math.max(log2(u), log2(v));
    let shift = BigInt(Math.max(len - hiBits, 0));

    let uhi = Number(u >> shift);
    let vhi = Number(v >> shift);

    for (let j = 0; j < w; j++) {
      if ((ulo & 1) === 0) {
        uhi >>= 1;
        ulo >>= 1;
        f1 <<= 1;
        g1 <<= 1;
      } else if ((vlo & 1) === 0) {
        vhi >>= 1;
        vlo >>= 1;
        f0 <<= 1;
        g0 <<= 1;
      } else {
        if (vhi <= uhi) {
          uhi = (uhi - vhi) >> 1;
          ulo = (ulo - vlo) >> 1;
          f0 = f0 + f1;
          g0 = g0 + g1;
          f1 <<= 1;
          g1 <<= 1;
        } else {
          vhi = (vhi - uhi) >> 1;
          vlo = (vlo - ulo) >> 1;
          f1 = f0 + f1;
          g1 = g0 + g1;
          f0 <<= 1;
          g0 <<= 1;
        }
      }
    }

    let f0n = BigInt(f0);
    let g0n = BigInt(g0);
    let f1n = BigInt(f1);
    let g1n = BigInt(g1);

    let unew = u * f0n - v * g0n;
    let vnew = v * g1n - u * f1n;
    u = unew >> wn;
    v = vnew >> wn;

    if (u < 0) (u = -u), (f0n = -f0n), (g0n = -g0n);
    if (v < 0) (v = -v), (f1n = -f1n), (g1n = -g1n);

    let rnew = r * f0n + s * g0n;
    let snew = s * g1n + r * f1n;
    r = rnew;
    s = snew;

    // these assertions are all true, enable when debugging:
    // let lin = v * r + u * s;
    // assert(lin === p || lin === -p, 'linear combination');
    // let k = BigInt((i + 1) * w);
    // assert(mod(x * r + u * 2n ** k, p) === 0n, 'mod p, r');
    // assert(mod(x * s - v * 2n ** k, p) === 0n, 'mod p, s');

    if (u === 0n) break;

    // empirically this never happens, but there might be unlucky edge cases where it does, due to sign flips
    if (v === 0n) {
      assert(u === 1n, "u = 1");
      s = mod(-r, p);
      break;
    }
  }
  let k = BigInt((i + 1) * w);

  // now s = 2^k/x mod p
  // correction step to go from 2^k/x to 1/x
  s = mod(s * twoToMinusKmax, p); // s <- s * 2^(-kmax) = 2^(k - kmax)/x
  s = mod(s << (kmax - k), p); // s <- s * 2^(kmax - k) = 1/x

  // yes this has a slight cost and the assert is never triggered,
  // but it's worth having for the sake of assurance
  assert(mod(x * s - 1n, p) === 0n, "mod p");
  return s;
}

function sqrt(n: bigint, p: bigint, Q: bigint, c: bigint, M: bigint) {
  // https://en.wikipedia.org/wiki/Tonelli-Shanks_algorithm#The_algorithm
  // variable naming is the same as in that link ^
  // Q is what we call `t` elsewhere - the odd factor in p - 1
  // c is a known primitive root of unity
  // M is the twoadicity = exponent of 2 in factorization of p - 1
  if (n === 0n) return 0n;
  let t = power(n, (Q - 1n) >> 1n, p); // n^(Q - 1)/2
  let R = mod(t * n, p); // n^((Q - 1)/2 + 1) = n^((Q + 1)/2)
  t = mod(t * R, p); // n^((Q - 1)/2 + (Q + 1)/2) = n^Q
  while (true) {
    if (t === 1n) return R;
    // use repeated squaring to find the least i, 0 < i < M, such that t^(2^i) = 1
    let i = 0n;
    let s = t;
    while (s !== 1n) {
      s = mod(s * s, p);
      i = i + 1n;
    }
    if (i === M) return undefined; // no solution
    let b = power(c, 1n << (M - i - 1n), p); // c^(2^(M-i-1))
    M = i;
    c = mod(b * b, p);
    t = mod(t * c, p);
    R = mod(R * b, p);
  }
}

function isSquare(x: bigint, p: bigint) {
  if (x === 0n) return true;
  let sqrt1 = power(x, (p - 1n) / 2n, p);
  return sqrt1 === 1n;
}

function bytesToBigInt(bytes: Uint8Array | number[]) {
  let x = 0n;
  let bitPosition = 0n;
  for (let byte of bytes) {
    x += BigInt(byte) << bitPosition;
    bitPosition += 8n;
  }
  return x;
}

function randomField(p: bigint, sizeInBytes: number, hiBitMask: number) {
  // strategy: find random 255-bit bigints and use the first that's smaller than p
  while (true) {
    let bytes = randomBytes(sizeInBytes);
    bytes[sizeInBytes - 1] &= hiBitMask; // zero highest bit, so we get 255 random bits
    let x = bytesToBigInt(bytes);
    if (x < p) return x;
  }
}

const PoseidonSpec = createPoseidon(Fp, poseidonParamsKimchiFp);

const Poseidon = {
  ...PoseidonSpec,
  hashToGroup: makeHashToGroup(PoseidonSpec.hash),
};

type GroupMapParams = {
  u: bigint;
  u_over_2: bigint;
  conic_c: bigint;
  projection_point: {
    z: bigint;
    y: bigint;
  };
  spec: { a: bigint; b: bigint };
};

type Conic = { z: bigint; y: bigint };

type STuple = { u: bigint; v: bigint; y: bigint };

// reference implementation https://github.com/o1-labs/snarky/blob/78e0d952518f75b5382f6d735adb24eef7a0fa90/group_map/group_map.ml
const GroupMap = {
  create: (F: FiniteField, params: GroupMapParams) => {
    const { a, b } = params.spec;
    if (a !== 0n) throw Error("GroupMap only supports a = 0");
    function tryDecode(x: bigint): { x: bigint; y: bigint } | undefined {
      // x^3
      const pow3 = F.power(x, 3n);
      // a * x - since a = 0, ax will be 0 as well
      // const ax = F.mul(a, x);

      // x^3 + ax + b, but since ax = 0 we can write x^3 + b
      const y = F.add(pow3, b);

      if (!F.isSquare(y)) return undefined;
      return { x, y: F.sqrt(y)! };
    }

    function sToVTruncated(s: STuple): [bigint, bigint, bigint] {
      const { u, v, y } = s;
      return [v, F.negate(F.add(u, v)), F.add(u, F.square(y))];
    }

    function conic_to_s(c: Conic): STuple {
      const d = F.div(c.z, c.y);
      if (d === undefined) throw Error(`Division undefined! ${c.z}/${c.y}`);
      const v = F.sub(d, params.u_over_2);

      return { u: params.u, v, y: c.y };
    }

    function field_to_conic(t: bigint): Conic {
      const { z: z0, y: y0 } = params.projection_point;

      const ct = F.mul(params.conic_c, t);

      const d1 = F.add(F.mul(ct, y0), z0);
      const d2 = F.add(F.mul(ct, t), 1n);

      const d = F.div(d1, d2);

      if (d === undefined) throw Error(`Division undefined! ${d1}/${d2}`);

      const s = F.mul(2n, d);

      return {
        z: F.sub(z0, s),
        y: F.sub(y0, F.mul(s, t)),
      };
    }

    return {
      potentialXs: (t: bigint) => sToVTruncated(conic_to_s(field_to_conic(t))),
      tryDecode,
    };
  },
};

const GroupMapParamsFp = {
  u: 2n,
  u_over_2: 1n,
  conic_c: 3n,
  projection_point: {
    z: 12196889842669319921865617096620076994180062626450149327690483414064673774441n,
    y: 1n,
  },
  spec: {
    a: 0n,
    b: 5n,
  },
};

const GroupMapPallas = GroupMap.create(Fp, GroupMapParamsFp);
