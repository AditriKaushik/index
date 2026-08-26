// Mahendra's Speed Test — BANK stream, format demonstration slice.
// Copy this file, replace the items, scale each section to 25, drop `draft`.
//
// Item shapes:
//   { dir:true, range:'Q.1-5.', en, hi }              grouped directions
//   { n, en, hi, o:[...], oh:[...], ans }             a question (ans is optional, for the key)
//   { n, en, hi, stem, stemHi, o, oh }                question + a quoted sentence/expression
//   { n, en, hi, passage:[...], passageHi:[...] }     question carrying a passage
//   { n, en, fig:'figures/q7.png', o }                figure-based (SSC)
// In `flow` sections only the English side is read.

export default {
  draft: true,
  brand: {
    exam: 'BANK GENERAL', code: 'ST-30',
    subtitle: '(FOR ALL BANK, INSURANCE & RELATED EXAMS)',
    optionStyle: 'numeric',                    // BANK = (1)-(5);  SSC = 'alpha' = (A)-(D)
    questions: 100, marks: 100, minutes: 60, negative: '1/4',
    sectionsLine: 'Reasoning : 25, English : 25, Maths : 25,  GA : 25',
  },
  sections: [
    {
      name: 'REASONING', hindi: 'तर्कशक्ति', mode: 'parallel',
      items: [
        { dir: true, range: 'Q.1-5.',
          en: 'Study the following information carefully and answer the questions given below. Eight friends — A, B, C, D, E, F, G and H — are sitting in a straight row, all facing north. C sits third to the left of F. Only three persons sit between F and H. A sits second to the right of H. Both B and G sit at the extreme ends of the row. D sits third to the left of B.',
          hi: 'निम्नलिखित जानकारी का ध्यानपूर्वक अध्ययन करें और नीचे दिए गए प्रश्नों के उत्तर दें। आठ मित्र — A, B, C, D, E, F, G तथा H — एक सीधी पंक्ति में उत्तर की ओर मुख करके बैठे हैं। C, F के बायें तीसरा है। F और H के बीच केवल तीन व्यक्ति बैठे हैं। A, H के दायें दूसरा है। B और G दोनों पंक्ति के अंतिम छोरों पर बैठे हैं। D, B के बायें तीसरा है।' },
        { n: 1, en: 'How many persons sit between A and E?', hi: 'A और E के बीच कितने व्यक्ति बैठे हैं?',
          o: ['None', 'One', 'Two', 'Three', 'Four'], oh: ['कोई नहीं', 'एक', 'दो', 'तीन', 'चार'], ans: 2 },
        { n: 2, en: 'Who sits immediately to the left of F?', hi: 'F के ठीक बायें कौन बैठा है?',
          o: ['A', 'D', 'E', 'C', 'H'], ans: 1 },
        { n: 3, en: 'What is the position of C with respect to E?', hi: 'E के सन्दर्भ में C का स्थान क्या है?',
          o: ['Second to the left', 'Third to the left', 'Fourth to the left', 'Fourth to the right', 'Third to the right'],
          oh: ['बायें दूसरा', 'बायें तीसरा', 'बायें चौथा', 'दायें चौथा', 'दायें तीसरा'], ans: 2 },
        { dir: true, range: 'Q.4-5.',
          en: 'In each question below are given two statements followed by two conclusions numbered I and II. You have to take the given statements to be true even if they seem to be at variance from the commonly known facts. Give answer – (1) If only conclusion I follows. (2) If only conclusion II follows. (3) If either conclusion I or II follows. (4) If neither conclusion I nor II follows. (5) If both conclusions I and II follow.',
          hi: 'नीचे प्रत्येक प्रश्न में दो कथन और उसके बाद दो निष्कर्ष I और II दिये गये हैं। आपको दिये गये कथनों को सत्य मानना है चाहे वे सामान्यतः ज्ञात तथ्यों से भिन्न क्यों न हों। उत्तर दीजिए – (1) यदि केवल निष्कर्ष I अनुसरण करता है। (2) यदि केवल निष्कर्ष II अनुसरण करता है। (3) या तो निष्कर्ष I या II अनुसरण करता है। (4) यदि न तो निष्कर्ष I और न ही II अनुसरण करता है। (5) यदि दोनों निष्कर्ष I और II अनुसरण करते हैं।' },
        { n: 4, en: 'Statements- All banks are offices. All offices are buildings.',
          hi: 'कथन- सभी बैंक कार्यालय हैं। सभी कार्यालय इमारतें हैं।',
          stem: 'Conclusions-  I. All banks are buildings.   II. Some buildings are banks.',
          stemHi: 'निष्कर्ष-  I. सभी बैंक इमारतें हैं।   II. कुछ इमारतें बैंक हैं।',
          o: ['Only I', 'Only II', 'Either I or II', 'Neither I nor II', 'Both I and II'],
          oh: ['केवल I', 'केवल II', 'या तो I या II', 'न तो I न II', 'दोनों I और II'], ans: 4 },
        { n: 5, en: 'Statements- Some pens are books. All books are papers.',
          hi: 'कथन- कुछ पेन पुस्तकें हैं। सभी पुस्तकें कागज हैं।',
          stem: 'Conclusions-  I. Some pens are papers.   II. All papers are books.',
          stemHi: 'निष्कर्ष-  I. कुछ पेन कागज हैं।   II. सभी कागज पुस्तकें हैं।',
          o: ['Only I', 'Only II', 'Either I or II', 'Neither I nor II', 'Both I and II'],
          oh: ['केवल I', 'केवल II', 'या तो I या II', 'न तो I न II', 'दोनों I और II'], ans: 0 },
      ],
    },
    {
      // English is English-only and flows continuously across both columns.
      name: 'ENGLISH', hindi: 'अंग्रेजी भाषा', mode: 'flow',
      items: [
        { dir: true, range: 'Q.6-7.',
          en: 'In each of the following questions, a sentence is given with a blank indicating that something has been omitted. Choose the option that correctly fills the blank.' },
        { n: 6, en: 'The new branch premises need ______ before customer operations can begin.',
          o: ['renovating', 'to renovating', 'renovate', 'renovated by', 'have renovate'], ans: 0 },
        { n: 7, en: 'As far as liquidity risk ______, the board has requested monthly reports.',
          o: ['concerns', 'is concerned', 'has concern', 'concerning', 'was concern'], ans: 1 },
        { n: 8, en: 'Select the most appropriate synonym of the word given in bold.',
          stem: 'An **inadvertent** entry in the beneficiary field caused the payment to be held for review.',
          o: ['Deliberate', 'Unintentional', 'Calculated', 'Premeditated', 'Strategic'], ans: 1 },
        { dir: true, range: 'Q.9-10.', en: 'Read the following passage and answer the given questions.' },
        { n: 9, en: 'Which of the following best explains the main idea of the passage?',
          passage: [
            'Bank stress testing examines how an institution might perform under severe but plausible adverse conditions. A scenario may combine a sharp economic contraction, market losses, deposit outflows, or deterioration in borrower quality.',
            'A stress test is not a forecast of what will definitely happen. Its value lies in exposing vulnerabilities that may remain hidden under normal conditions. Results depend on assumptions, data quality, and models, so precise figures should not be treated as unquestionable facts.',
          ],
          o: ['Stress testing predicts the exact timing of every banking crisis.',
              'Stress testing explores vulnerabilities under adverse scenarios and is valuable when findings guide concrete risk decisions.',
              'Stress-test figures are independent of assumptions and data quality.',
              'Reverse stress testing begins with a minor operational inconvenience.',
              'Boards should accept all model results without challenge.'], ans: 1 },
        { n: 10, en: 'Improve the underlined part of the sentence.',
          stem: 'The revised policy __aims at to reduce__ manual intervention in exception handling.',
          o: ['aims at reducing', 'aims for to reduce', 'is aiming at reduce', 'aims on reducing', 'No improvement'], ans: 0 },
      ],
    },
    {
      name: 'MATHS', hindi: 'गणित', mode: 'parallel',
      items: [
        { n: 11, en: 'Find the average of the following set of scores:', hi: 'निम्नलिखित अंकों के समूह का औसत ज्ञात कीजिए:',
          stem: '304, 162, 152, 132 and 110.', stemHi: '304, 162, 152, 132 और 110।',
          o: ['182', '188', '172', '162', 'None of these'],
          oh: ['182', '188', '172', '162', 'इनमें से कोई नहीं'], ans: 3 },
        { n: 12, en: 'If the numerator of a fraction is increased by 30% and the denominator is increased by 40%, the fraction becomes 39/56. Find the original fraction.',
          hi: 'यदि किसी भिन्न के अंश में 30% और हर में 40% की वृद्धि की जाए, तो भिन्न 39/56 हो जाती है। मूल भिन्न ज्ञात कीजिए।',
          o: ['7/9', '13/14', '3/4', '3/5', 'None of these'],
          oh: ['7/9', '13/14', '3/4', '3/5', 'इनमें से कोई नहीं'], ans: 2 },
        { n: 13, en: 'What value will come in place of question mark (?) in the following question?',
          hi: 'निम्नलिखित प्रश्न में प्रश्नवाचक चिह्न (?) के स्थान पर क्या मान आएगा?',
          stem: '(9 × 36 ÷ 3 + 7) ÷ (16 ÷ 4 + 3² ÷ 3) = ?',
          o: ['16 (3/7)', '16 (2/3)', '16 (5/7)', '16 (1/7)', 'None of these'],
          oh: ['16 (3/7)', '16 (2/3)', '16 (5/7)', '16 (1/7)', 'इनमें से कोई नहीं'], ans: 0 },
      ],
    },
    {
      name: 'GENERAL AWARENESS', hindi: 'सामान्य जागरूकता', mode: 'parallel',
      items: [
        { n: 14, en: 'Which banking partner collaborated with NPCI to enable real-time foreign exchange (FX) settlement for international UPI payments?',
          hi: 'अंतरराष्ट्रीय UPI भुगतानों के लिए रीयल-टाइम विदेशी मुद्रा निपटान को सक्षम करने के लिए किस बैंकिंग भागीदार ने NPCI के साथ सहयोग किया?',
          o: ['HSBC India', 'ICICI Bank', 'HDFC Bank', 'Axis Bank', 'State Bank of India'],
          oh: ['एचएसबीसी इंडिया', 'आईसीआईसीआई बैंक', 'एचडीएफसी बैंक', 'एक्सिस बैंक', 'भारतीय स्टेट बैंक'], ans: 0 },
        { n: 15, en: 'What is the capital and currency of Australia?', hi: 'ऑस्ट्रेलिया की राजधानी और मुद्रा क्या है?',
          o: ['Sydney & Dollar', 'Canberra & Dollar', 'Melbourne & Pound', 'Canberra & Euro', 'Wellington & Dollar'],
          oh: ['सिडनी और डॉलर', 'कैनबरा और डॉलर', 'मेलबर्न और पाउंड', 'कैनबरा और यूरो', 'वेलिंगटन और डॉलर'], ans: 1 },
        { n: 16, en: "Kaziranga National Park, famous for the one-horned rhinoceros, is located in which Indian state?",
          hi: 'एक सींग वाले गैंडे के लिए प्रसिद्ध काजीरंगा राष्ट्रीय उद्यान भारत के किस राज्य में स्थित है?',
          o: ['West Bengal', 'Uttarakhand', 'Assam', 'Madhya Pradesh', 'Odisha'],
          oh: ['पश्चिम बंगाल', 'उत्तराखंड', 'असम', 'मध्य प्रदेश', 'ओडिशा'], ans: 2 },
      ],
    },
  ],
};
