// Section III - Reasoning Ability (Q66-100). Bilingual: English + Hindi.
const SYL = ['Only conclusion I follows','Only conclusion II follows','Either conclusion I or II follows','Neither conclusion I nor II follows','Both conclusions I and II follow'];
const SYLH = ['केवल निष्कर्ष I अनुसरण करता है','केवल निष्कर्ष II अनुसरण करता है','या तो निष्कर्ष I या II अनुसरण करता है','न तो निष्कर्ष I और न ही II अनुसरण करता है','निष्कर्ष I तथा II दोनों अनुसरण करते हैं'];

module.exports = {
  title: 'SECTION III — REASONING ABILITY',
  titleHi: 'खण्ड III — तर्कशक्ति',
  meta: 'Q. 66 to 100  |  35 Marks',
  items: [
    { dir:true, en:'Directions (Q. 66–70): Study the information carefully and answer the questions given below. Eight friends — A, B, C, D, E, F, G and H — are sitting in a straight row, all facing north. C sits third to the left of F. Only three persons sit between F and H. A sits second to the right of H. Both B and G sit at the extreme ends of the row. D sits third to the left of B.',
      hi:'निर्देश (प्र. 66–70): निम्नलिखित जानकारी का ध्यानपूर्वक अध्ययन कीजिए और नीचे दिए गए प्रश्नों के उत्तर दीजिए। आठ मित्र — A, B, C, D, E, F, G तथा H — एक सीधी पंक्ति में बैठे हैं और सभी का मुख उत्तर दिशा की ओर है। C, F के बाईं ओर तीसरे स्थान पर बैठा है। F तथा H के बीच केवल तीन व्यक्ति बैठे हैं। A, H के दाईं ओर दूसरे स्थान पर बैठा है। B तथा G दोनों पंक्ति के अंतिम छोरों पर बैठे हैं। D, B के बाईं ओर तीसरे स्थान पर बैठा है।' },
    { n:66, en:'How many persons sit between A and E?', hi:'A तथा E के बीच कितने व्यक्ति बैठे हैं?',
      o:['None','One','Two','Three','Four'], oh:['कोई नहीं','एक','दो','तीन','चार'], ans:2,
      sol:'Final order (left to right): G, H, C, A, D, F, E, B. A is 4th and E is 7th, so D and F sit between them — two persons.' },
    { n:67, en:'Who sits immediately to the left of F?', hi:'F के ठीक बाईं ओर कौन बैठा है?',
      o:['A','D','E','C','H'], ans:1, sol:'F is 6th; the 5th position is D.' },
    { n:68, en:'Which of the following pairs sits at the extreme ends of the row?', hi:'निम्नलिखित में से कौन-सा युग्म पंक्ति के अंतिम छोरों पर बैठा है?',
      o:['G and B','H and B','G and E','C and B','A and G'], oh:['G तथा B','H तथा B','G तथा E','C तथा B','A तथा G'], ans:0,
      sol:'G occupies position 1 and B occupies position 8.' },
    { n:69, en:'What is the position of C with respect to E?', hi:'E के सापेक्ष C का स्थान क्या है?',
      o:['Second to the left','Third to the left','Fourth to the left','Fourth to the right','Third to the right'],
      oh:['बाईं ओर दूसरा','बाईं ओर तीसरा','बाईं ओर चौथा','दाईं ओर चौथा','दाईं ओर तीसरा'], ans:2,
      sol:'C is 3rd and E is 7th, so C is fourth to the left of E.' },
    { n:70, en:'Four of the following five are alike in a certain way based on their positions in the arrangement and hence form a group. Which one does NOT belong to that group?',
      hi:'निम्नलिखित पाँच में से चार अपनी स्थिति के आधार पर किसी प्रकार से समान हैं और इस प्रकार एक समूह बनाते हैं। कौन-सा उस समूह से संबंधित नहीं है?',
      o:['G, C','H, A','C, D','A, F','D, B'], ans:4,
      sol:'In every other pair the second person sits second to the right of the first (G–C, H–A, C–D, A–F). D is 5th and B is 8th, i.e. third to the right — so D, B is the odd pair.' },

    { dir:true, en:'Directions (Q. 71–75): Study the information carefully and answer the questions given below. Seven persons — P, Q, R, S, T, U and V — live on seven different floors of a building. The lowest floor is numbered 1 and the topmost floor is numbered 7. Three persons live between P and Q. Q lives on an even-numbered floor above P. R lives immediately above S. T lives on floor number 1. U lives on the topmost floor. Only one person lives between S and P.',
      hi:'निर्देश (प्र. 71–75): निम्नलिखित जानकारी का ध्यानपूर्वक अध्ययन कीजिए और नीचे दिए गए प्रश्नों के उत्तर दीजिए। सात व्यक्ति — P, Q, R, S, T, U तथा V — एक इमारत की सात अलग-अलग मंजिलों पर रहते हैं। सबसे निचली मंजिल की संख्या 1 तथा सबसे ऊपरी मंजिल की संख्या 7 है। P तथा Q के बीच तीन व्यक्ति रहते हैं। Q, P के ऊपर किसी सम संख्या वाली मंजिल पर रहता है। R, S के ठीक ऊपर रहता है। T मंजिल संख्या 1 पर रहता है। U सबसे ऊपरी मंजिल पर रहता है। S तथा P के बीच केवल एक व्यक्ति रहता है।' },
    { n:71, en:'Who lives on floor number 3?', hi:'मंजिल संख्या 3 पर कौन रहता है?',
      o:['V','S','R','U','T'], ans:0,
      sol:'Final arrangement (floor 1 upward): T, P, V, S, R, Q, U. Floor 3 is V.' },
    { n:72, en:'How many persons live between R and Q?', hi:'R तथा Q के बीच कितने व्यक्ति रहते हैं?',
      o:['None','One','Two','Three','Four'], oh:['कोई नहीं','एक','दो','तीन','चार'], ans:0,
      sol:'R is on floor 5 and Q on floor 6 — they are adjacent, so nobody lives between them.' },
    { n:73, en:'Who lives immediately below Q?', hi:'Q के ठीक नीचे कौन रहता है?',
      o:['S','R','U','V','P'], ans:1, sol:'Q is on floor 6; floor 5 is occupied by R.' },
    { n:74, en:'If all the persons are made to live in alphabetical order from the bottom floor to the top, how many of them will remain on the same floor as before?',
      hi:'यदि सभी व्यक्तियों को नीचे की मंजिल से ऊपर की ओर वर्णानुक्रम में बसाया जाए, तो उनमें से कितने पहले वाली ही मंजिल पर रहेंगे?',
      o:['None','One','Two','Three','Four'], oh:['कोई नहीं','एक','दो','तीन','चार'], ans:1,
      sol:'Alphabetical order gives P, Q, R, S, T, U, V on floors 1–7. The original order is T, P, V, S, R, Q, U. Only S (floor 4) is unchanged.' },
    { n:75, en:'Which of the following combinations is correct?', hi:'निम्नलिखित में से कौन-सा संयोजन सही है?',
      o:['T — Floor 2','V — Floor 4','R — Floor 5','Q — Floor 7','U — Floor 3'],
      oh:['T — मंजिल 2','V — मंजिल 4','R — मंजिल 5','Q — मंजिल 7','U — मंजिल 3'], ans:2,
      sol:'R does live on floor 5. T is on 1, V on 3, Q on 6 and U on 7.' },

    { dir:true, en:'Directions (Q. 76–80): In each question below are given two statements followed by two conclusions numbered I and II. You have to take the given statements to be true even if they seem to be at variance with commonly known facts, and then decide which of the given conclusions logically follows. Give your answer as: (a) if only conclusion I follows; (b) if only conclusion II follows; (c) if either I or II follows; (d) if neither I nor II follows; (e) if both I and II follow.',
      hi:'निर्देश (प्र. 76–80): नीचे दिए गए प्रत्येक प्रश्न में दो कथन तथा उनके बाद I और II क्रमांकित दो निष्कर्ष दिए गए हैं। आपको दिए गए कथनों को सत्य मानना है, भले ही वे सर्वज्ञात तथ्यों से भिन्न प्रतीत हों, और फिर तय करना है कि कौन-सा निष्कर्ष तार्किक रूप से अनुसरण करता है। उत्तर इस प्रकार दीजिए: (a) यदि केवल निष्कर्ष I अनुसरण करता है; (b) यदि केवल निष्कर्ष II अनुसरण करता है; (c) यदि या तो I या II अनुसरण करता है; (d) यदि न तो I और न ही II अनुसरण करता है; (e) यदि I तथा II दोनों अनुसरण करते हैं।' },
    { n:76, en:'Statements: All banks are offices. All offices are buildings. Conclusions: I. All banks are buildings.  II. Some buildings are banks.',
      hi:'कथन: सभी बैंक कार्यालय हैं। सभी कार्यालय इमारतें हैं। निष्कर्ष: I. सभी बैंक इमारतें हैं।  II. कुछ इमारतें बैंक हैं।',
      o:SYL, oh:SYLH, ans:4,
      sol:'The two universal statements chain: banks ⊆ offices ⊆ buildings, so I follows. I then converts to "some buildings are banks", so II follows as well.' },
    { n:77, en:'Statements: Some pens are books. All books are papers. Conclusions: I. Some pens are papers.  II. All papers are books.',
      hi:'कथन: कुछ पेन पुस्तकें हैं। सभी पुस्तकें कागज हैं। निष्कर्ष: I. कुछ पेन कागज हैं।  II. सभी कागज पुस्तकें हैं।',
      o:SYL, oh:SYLH, ans:0,
      sol:'Those pens which are books must be papers, so I follows. II reverses a universal statement, which is invalid.' },
    { n:78, en:'Statements: No cat is a dog. All dogs are animals. Conclusions: I. No cat is an animal.  II. Some animals are not cats.',
      hi:'कथन: कोई बिल्ली कुत्ता नहीं है। सभी कुत्ते जानवर हैं। निष्कर्ष: I. कोई बिल्ली जानवर नहीं है।  II. कुछ जानवर बिल्लियाँ नहीं हैं।',
      o:SYL, oh:SYLH, ans:1,
      sol:'Dogs are animals and no dog is a cat, so those animals are not cats — II follows. I overreaches: cats may still be animals.' },
    { n:79, en:'Statements: All loans are assets. Some assets are risks. Conclusions: I. Some loans are risks.  II. No loan is a risk.',
      hi:'कथन: सभी ऋण परिसंपत्तियाँ हैं। कुछ परिसंपत्तियाँ जोखिम हैं। निष्कर्ष: I. कुछ ऋण जोखिम हैं।  II. कोई ऋण जोखिम नहीं है।',
      o:SYL, oh:SYLH, ans:2,
      sol:'Neither conclusion is established on its own, but I and II are a complementary pair (some / none of the same terms), so either I or II must hold.' },
    { n:80, en:'Statements: All cheques are documents. No document is a receipt. Conclusions: I. No cheque is a receipt.  II. Some documents are cheques.',
      hi:'कथन: सभी चेक दस्तावेज हैं। कोई दस्तावेज रसीद नहीं है। निष्कर्ष: I. कोई चेक रसीद नहीं है।  II. कुछ दस्तावेज चेक हैं।',
      o:SYL, oh:SYLH, ans:4,
      sol:'Cheques ⊆ documents and documents exclude receipts, so I follows. "All cheques are documents" converts to "some documents are cheques", so II follows.' },

    { dir:true, en:'Directions (Q. 81–85): In each question below are given certain relationships followed by two conclusions numbered I and II. Decide which of the conclusions definitely follows. Give your answer as: (a) if only conclusion I follows; (b) if only conclusion II follows; (c) if either I or II follows; (d) if neither I nor II follows; (e) if both I and II follow.',
      hi:'निर्देश (प्र. 81–85): नीचे दिए गए प्रत्येक प्रश्न में कुछ संबंध तथा उनके बाद I और II क्रमांकित दो निष्कर्ष दिए गए हैं। तय कीजिए कि कौन-सा निष्कर्ष निश्चित रूप से अनुसरण करता है। उत्तर इस प्रकार दीजिए: (a) यदि केवल निष्कर्ष I अनुसरण करता है; (b) यदि केवल निष्कर्ष II अनुसरण करता है; (c) यदि या तो I या II अनुसरण करता है; (d) यदि न तो I और न ही II अनुसरण करता है; (e) यदि I तथा II दोनों अनुसरण करते हैं।' },
    { n:81, en:'Statements: P > Q ≥ R;  R < S ≤ T Conclusions: I. P > R   II. S > Q',
      hi:'कथन: P > Q ≥ R;  R < S ≤ T निष्कर्ष: I. P > R   II. S > Q',
      o:SYL, oh:SYLH, ans:0,
      sol:'P > Q ≥ R gives P > R, so I follows. Between S and Q there is no common chain of consistent signs, so II is not definite.' },
    { n:82, en:'Statements: A ≤ B < C;  C ≥ D > E Conclusions: I. A < C   II. C > E',
      hi:'कथन: A ≤ B < C;  C ≥ D > E निष्कर्ष: I. A < C   II. C > E',
      o:SYL, oh:SYLH, ans:4,
      sol:'A ≤ B < C gives A < C. C ≥ D > E gives C > E. Both follow.' },
    { n:83, en:'Statements: M ≥ N = O;  O > P ≥ Q Conclusions: I. Q > N   II. M > Q',
      hi:'कथन: M ≥ N = O;  O > P ≥ Q निष्कर्ष: I. Q > N   II. M > Q',
      o:SYL, oh:SYLH, ans:1,
      sol:'M ≥ N = O > P ≥ Q yields M > Q, so II follows. The same chain shows N > Q, which contradicts I.' },
    { n:84, en:'Statements: X < Y ≤ Z;  Z = W < V Conclusions: I. X < W   II. V > Y',
      hi:'कथन: X < Y ≤ Z;  Z = W < V निष्कर्ष: I. X < W   II. V > Y',
      o:SYL, oh:SYLH, ans:4,
      sol:'X < Y ≤ Z = W gives X < W. Y ≤ Z = W < V gives Y < V, i.e. V > Y. Both follow.' },
    { n:85, en:'Statements: F ≥ G > H;  H = I ≥ J Conclusions: I. F > J   II. G = J',
      hi:'कथन: F ≥ G > H;  H = I ≥ J निष्कर्ष: I. F > J   II. G = J',
      o:SYL, oh:SYLH, ans:0,
      sol:'F ≥ G > H = I ≥ J gives F > J, so I follows. The same chain gives G > J, so equality in II is ruled out.' },

    { dir:true, en:'Directions (Q. 86–88): Study the following arrangement carefully and answer the questions given below.  5  K  @  2  P  R  8  %  T  3  M  #  7  W  N  4  ©  B  9  Q  ★  6  D',
      hi:'निर्देश (प्र. 86–88): निम्नलिखित व्यवस्था का ध्यानपूर्वक अध्ययन कीजिए और नीचे दिए गए प्रश्नों के उत्तर दीजिए।  5  K  @  2  P  R  8  %  T  3  M  #  7  W  N  4  ©  B  9  Q  ★  6  D' },
    { n:86, en:'How many such symbols are there in the arrangement, each of which is immediately preceded by a digit and immediately followed by a letter?',
      hi:'उपर्युक्त व्यवस्था में ऐसे कितने प्रतीक हैं, जिनमें से प्रत्येक के ठीक पहले एक अंक तथा ठीक बाद एक अक्षर है?',
      o:['None','One','Two','Three','More than three'], oh:['कोई नहीं','एक','दो','तीन','तीन से अधिक'], ans:2,
      sol:'They are 8 % T and 4 © B — two such symbols. (@ and # and ★ are each preceded by a letter.)' },
    { n:87, en:'Which element is seventh to the right of the fifteenth element from the left end of the arrangement?',
      hi:'व्यवस्था के बाएँ छोर से पंद्रहवें तत्व के दाईं ओर सातवाँ तत्व कौन-सा है?',
      o:['6','Q','★','D','9'], ans:0,
      sol:'The 15th element from the left is N. Seven places to its right is the 22nd element, which is 6.' },
    { n:88, en:'How many such letters are there in the arrangement, each of which is immediately followed by a digit?',
      hi:'उपर्युक्त व्यवस्था में ऐसे कितने अक्षर हैं, जिनमें से प्रत्येक के ठीक बाद एक अंक है?',
      o:['Two','Three','Four','Five','Six'], oh:['दो','तीन','चार','पाँच','छह'], ans:2,
      sol:'They are R 8, T 3, N 4 and B 9 — four such letters.' },

    { dir:true, en:'Directions (Q. 89–93): Study the information carefully and answer the questions given below. In a certain code language: "bank gives easy loan" is written as "ta ri no se", "easy loan for all" is written as "no se ka da", "bank has easy branch" is written as "ri mo se pu", "all loan approved now" is written as "ka no zi lo".',
      hi:'निर्देश (प्र. 89–93): निम्नलिखित जानकारी का ध्यानपूर्वक अध्ययन कीजिए और नीचे दिए गए प्रश्नों के उत्तर दीजिए। एक निश्चित कूट भाषा में: "bank gives easy loan" को "ta ri no se" लिखा जाता है, "easy loan for all" को "no se ka da" लिखा जाता है, "bank has easy branch" को "ri mo se pu" लिखा जाता है, "all loan approved now" को "ka no zi lo" लिखा जाता है।' },
    { n:89, en:'What is the code for ‘easy’?', hi:'‘easy’ के लिए कूट क्या है?',
      o:['no','se','ri','ta','ka'], ans:1,
      sol:'Statements 1 and 4 share only "loan", so loan = no. Statements 1 and 2 share loan and easy = no, se; hence easy = se.' },
    { n:90, en:'Which of the following may represent ‘bank has money’?', hi:'निम्नलिखित में से कौन-सा ‘bank has money’ को दर्शा सकता है?',
      o:['ri mo fa','se pu fa','ri ka fa','no mo ri','ta pu fa'], ans:0,
      sol:'bank = ri; "has" is one of mo / pu; "money" is a new word needing a new code. "ri mo fa" fits.' },
    { n:91, en:'The code ‘ka no’ represents which of the following?', hi:'कूट ‘ka no’ निम्नलिखित में से किसे दर्शाता है?',
      o:['easy bank','all loan','loan for','bank easy','now approved'],
      oh:['easy bank','all loan','loan for','bank easy','now approved'], ans:1,
      sol:'Statements 2 and 4 share loan and all = no, ka. Since loan = no, all = ka. So "ka no" is "all loan".' },
    { n:92, en:'What is the code for ‘gives’?', hi:'‘gives’ के लिए कूट क्या है?',
      o:['ri','se','ta','no','da'], ans:2,
      sol:'In statement 1, bank = ri, easy = se and loan = no, leaving ta for "gives".' },
    { n:93, en:'The code ‘da’ stands for:', hi:'कूट ‘da’ किसके लिए है:',
      o:['all','for','has','branch','now'], oh:['all','for','has','branch','now'], ans:1,
      sol:'In statement 2, easy = se, loan = no and all = ka, leaving da for "for".' },

    { dir:true, en:'Directions (Q. 94–100): Read each question carefully and choose the correct answer.',
      hi:'निर्देश (प्र. 94–100): प्रत्येक प्रश्न को ध्यानपूर्वक पढ़िए और सही उत्तर चुनिए।' },
    { n:94, en:'Pointing to a photograph, Rahul said, "She is the daughter of the only son of my grandmother." How is the woman in the photograph related to Rahul?',
      hi:'एक तस्वीर की ओर संकेत करते हुए राहुल ने कहा, "वह मेरी दादी के इकलौते पुत्र की पुत्री है।" तस्वीर वाली महिला राहुल से किस प्रकार संबंधित है?',
      o:['Mother','Aunt','Sister','Cousin','Niece'], oh:['माता','चाची','बहन','चचेरी बहन','भतीजी'], ans:2,
      sol:'The only son of Rahul’s grandmother is Rahul’s father; his daughter is therefore Rahul’s sister.' },
    { n:95, en:'A is the brother of B. C is the mother of B. D is the father of C. E is the mother of D. How is A related to D?',
      hi:'A, B का भाई है। C, B की माता है। D, C का पिता है। E, D की माता है। A, D से किस प्रकार संबंधित है?',
      o:['Son','Grandson','Nephew','Brother','Father'], oh:['पुत्र','नाती','भतीजा','भाई','पिता'], ans:1,
      sol:'A is B’s brother, so C is A’s mother too. D is C’s father, hence A is D’s grandson.' },
    { n:96, en:'In a family, P is the wife of Q. R is the son of P. S is the sister of Q. T is the daughter of S. How is T related to R?',
      hi:'एक परिवार में P, Q की पत्नी है। R, P का पुत्र है। S, Q की बहन है। T, S की पुत्री है। T, R से किस प्रकार संबंधित है?',
      o:['Sister','Niece','Cousin','Aunt','Daughter'], oh:['बहन','भतीजी','चचेरी बहन','बुआ','पुत्री'], ans:2,
      sol:'S is Q’s sister, so S is R’s aunt. T, being S’s daughter, is R’s cousin.' },
    { n:97, en:'A man walks 12 m towards the north, turns right and walks 8 m, then turns right and walks 12 m, and finally turns left and walks 5 m. How far and in which direction is he from his starting point?',
      hi:'एक व्यक्ति उत्तर दिशा में 12 मीटर चलता है, दाएँ मुड़कर 8 मीटर चलता है, फिर दाएँ मुड़कर 12 मीटर चलता है और अंत में बाएँ मुड़कर 5 मीटर चलता है। वह अपने प्रारंभिक बिंदु से कितनी दूर और किस दिशा में है?',
      o:['13 m, east','13 m, west','8 m, east','5 m, east','20 m, north'],
      oh:['13 मीटर, पूर्व','13 मीटर, पश्चिम','8 मीटर, पूर्व','5 मीटर, पूर्व','20 मीटर, उत्तर'], ans:0,
      sol:'Taking the start as (0, 0): north 12 → (0, 12); east 8 → (8, 12); south 12 → (8, 0); east 5 → (13, 0). He is 13 m east of the start.' },
    { n:98, en:'Ravi starts from point X, walks 10 m towards the south, turns left and walks 15 m, then turns left again and walks 10 m to reach point Y. What is the distance and direction of Y from X?',
      hi:'रवि बिंदु X से चलना शुरू करता है, दक्षिण दिशा में 10 मीटर चलता है, बाएँ मुड़कर 15 मीटर चलता है, फिर बाएँ मुड़कर 10 मीटर चलकर बिंदु Y पर पहुँचता है। Y, X से कितनी दूरी पर और किस दिशा में है?',
      o:['10 m, east','15 m, east','15 m, west','25 m, east','20 m, south'],
      oh:['10 मीटर, पूर्व','15 मीटर, पूर्व','15 मीटर, पश्चिम','25 मीटर, पूर्व','20 मीटर, दक्षिण'], ans:1,
      sol:'From (0, 0): south 10 → (0, −10); left (east) 15 → (15, −10); left (north) 10 → (15, 0). Y is 15 m east of X.' },
    { n:99, en:'If all the letters of the word IMPORTANCE are arranged in alphabetical order from left to right, which letter will be fifth from the right end?',
      hi:'यदि शब्द IMPORTANCE के सभी अक्षरों को बाएँ से दाएँ वर्णानुक्रम में व्यवस्थित किया जाए, तो दाएँ छोर से पाँचवाँ अक्षर कौन-सा होगा?',
      o:['M','N','O','I','P'], ans:1,
      sol:'Alphabetically: A, C, E, I, M, N, O, P, R, T (10 letters). The fifth from the right is the sixth from the left, which is N.' },
    { n:100, en:'In a row of 40 students, Amit is 12th from the left end and Sneha is 18th from the right end. How many students are there between them?',
      hi:'40 विद्यार्थियों की एक पंक्ति में अमित बाएँ छोर से 12वें स्थान पर तथा स्नेहा दाएँ छोर से 18वें स्थान पर है। उनके बीच कितने विद्यार्थी हैं?',
      o:['8','9','10','11','12'], ans:2,
      sol:'Sneha’s position from the left = 40 − 18 + 1 = 23. Students between = 23 − 12 − 1 = 10.' }
  ]
};
