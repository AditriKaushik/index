const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
        Table, TableRow, TableCell, WidthType, ShadingType, PageBreak, Header, Footer,
        PageNumber, convertInchesToTwip } = d;
const fs = require('fs');

const EN = 'Times New Roman', HI = 'Nirmala UI', SANS = 'Arial';
const INK = '1A1A1A', MUTE = '5A5A5A', RULE = 'B0B4BC', BAND = 'E8EBF0', ACCENT = '17365D';
const USABLE = 9740;                       // A4 width 11906 - 2*1083 margins

const sections = [
  require('./sec-english.js'),
  require('./sec-numerical.js'),
  require('./sec-reasoning.js'),
];
const LETTERS = ['a','b','c','d','e'];

// Spread correct answers evenly across (a)-(e); leaves semantically-ordered option sets alone.
const balance = require('./rebalance.js').rebalance(sections);
console.log('option balance ->', balance.counts.map((c,i)=>LETTERS[i]+':'+c).join('  '),
            `(${balance.movable} permuted, ${balance.fixed} left in authored order)`);

const SPLIT = /[\u2028\u2029]/;
const splitPara = txt => String(txt).split(SPLIT).map(x=>x.trim()).filter(Boolean);
// build runs from text containing **bold** spans
function runs(text, o={}){
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(seg =>
    seg.startsWith('**') && seg.endsWith('**')
      ? t(seg.slice(2,-2), { ...o, bold:true })
      : t(seg, o));
}

const t  = (text, o={}) => new TextRun({ text, font: o.hindi?HI:EN, size:o.size||19,
              bold:!!o.bold, italics:!!o.it, color:o.color||INK });
const p  = (children, o={}) => new Paragraph({ children: Array.isArray(children)?children:[children],
              spacing:{ before:o.before||0, after:o.after===undefined?60:o.after, line:o.line||252 },
              alignment:o.align, indent:o.indent, keepNext:!!o.keepNext, border:o.border });

function rule(){ return new Paragraph({ spacing:{before:40,after:120},
  border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:RULE } } }); }

// ---------- masthead ----------
function masthead(){
  const out = [];
  out.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:0},
    children:[ new TextRun({ text:'BANK OFFLINE SPEED TEST', font:SANS, size:32, bold:true, color:ACCENT, characterSpacing:24 }) ] }));
  out.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:40,after:40},
    children:[ new TextRun({ text:'ST — 01', font:SANS, size:44, bold:true, color:INK, characterSpacing:40 }) ] }));
  out.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:20},
    children:[ new TextRun({ text:'IBPS / SBI Clerk — Preliminary Examination Pattern', font:SANS, size:19, color:MUTE }) ] }));
  out.push(new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:160},
    children:[ new TextRun({ text:'आई.बी.पी.एस. / एस.बी.आई. क्लर्क — प्रारंभिक परीक्षा प्रारूप', font:HI, size:19, color:MUTE }) ] }));

  const cell = (txt, sub, w) => new TableCell({ width:{size:w,type:WidthType.DXA},
    shading:{ type:ShadingType.CLEAR, fill:BAND, color:'auto' },
    margins:{ top:90, bottom:90, left:120, right:120 },
    borders:{ top:{style:BorderStyle.SINGLE,size:4,color:RULE}, bottom:{style:BorderStyle.SINGLE,size:4,color:RULE},
              left:{style:BorderStyle.SINGLE,size:4,color:RULE}, right:{style:BorderStyle.SINGLE,size:4,color:RULE} },
    children:[ new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:0},
                 children:[ new TextRun({ text:txt, font:SANS, size:16, color:MUTE, characterSpacing:12 }) ] }),
               new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:20,after:0},
                 children:[ new TextRun({ text:sub, font:SANS, size:22, bold:true, color:INK }) ] }) ] });
  const w = Math.floor(USABLE/4);
  out.push(new Table({ width:{size:USABLE,type:WidthType.DXA}, columnWidths:[w,w,w,USABLE-3*w],
    rows:[ new TableRow({ children:[ cell('QUESTIONS','100', w), cell('MARKS','100', w),
                                     cell('TIME','60 min', w), cell('NEGATIVE','0.25', USABLE-3*w) ] }) ] }));
  out.push(new Paragraph({ spacing:{after:160}, children:[] }));
  return out;
}

// ---------- instructions ----------
function instructions(){
  const out = [];
  out.push(p(t('GENERAL INSTRUCTIONS  /  सामान्य निर्देश', { bold:true, size:20, color:ACCENT }), { after:100 }));
  const rows = [
    ['The test contains 100 questions carrying 1 mark each. The total time allowed is 60 minutes.',
     'इस परीक्षा में 100 प्रश्न हैं, प्रत्येक 1 अंक का। कुल निर्धारित समय 60 मिनट है।'],
    ['There are three sections — English Language (30), Numerical Ability (35) and Reasoning Ability (35). There is no separate timing for the sections.',
     'तीन खण्ड हैं — अंग्रेजी भाषा (30), संख्यात्मक अभियोग्यता (35) तथा तर्कशक्ति (35)। खण्डों के लिए अलग समय निर्धारित नहीं है।'],
    ['Each question has five options marked (a), (b), (c), (d) and (e). Darken only one oval per question on the OMR sheet.',
     'प्रत्येक प्रश्न के पाँच विकल्प (a), (b), (c), (d) तथा (e) हैं। ओ.एम.आर. शीट पर प्रति प्रश्न केवल एक गोला ही काला करें।'],
    ['One-fourth (0.25) of the marks assigned to a question will be deducted for every wrong answer. No marks are deducted for questions left blank.',
     'प्रत्येक गलत उत्तर के लिए उस प्रश्न के निर्धारित अंकों का एक-चौथाई (0.25) अंक काटा जाएगा। अनुत्तरित प्रश्नों पर कोई अंक नहीं काटा जाएगा।'],
    ['Use a black or blue ball-point pen only. Rough work must be done on the sheet provided, never on the OMR sheet.',
     'केवल काले या नीले बॉल-पॉइंट पेन का प्रयोग करें। रफ कार्य दी गई शीट पर ही करें, ओ.एम.आर. शीट पर कदापि नहीं।'],
    ['In case of any discrepancy between the English and the Hindi version of a question, the English version shall be treated as final.',
     'किसी प्रश्न के अंग्रेजी तथा हिंदी रूपांतर में भिन्नता होने पर अंग्रेजी रूपांतर ही अंतिम माना जाएगा।'],
  ];
  rows.forEach((r,i) => {
    out.push(p([ t(`${i+1}.  `, { bold:true }), t(r[0]) ], { after:20, indent:{ left:260, hanging:260 } }));
    out.push(p(t(r[1], { hindi:true, color:MUTE }), { after:90, indent:{ left:260 } }));
  });
  out.push(rule());
  return out;
}

// ---------- question rendering ----------
function renderSectionHeader(sec){
  const out = [];
  out.push(new Paragraph({ spacing:{before:200,after:0}, shading:{ type:ShadingType.CLEAR, fill:ACCENT, color:'auto' },
    alignment:AlignmentType.CENTER,
    children:[ new TextRun({ text:sec.title, font:SANS, size:22, bold:true, color:'FFFFFF', characterSpacing:16 }) ] }));
  out.push(new Paragraph({ spacing:{before:0,after:0}, shading:{ type:ShadingType.CLEAR, fill:ACCENT, color:'auto' },
    alignment:AlignmentType.CENTER,
    children:[ new TextRun({ text:sec.titleHi, font:HI, size:19, color:'D9E2F0' }) ] }));
  out.push(new Paragraph({ spacing:{before:0,after:140}, shading:{ type:ShadingType.CLEAR, fill:ACCENT, color:'auto' },
    alignment:AlignmentType.CENTER,
    children:[ new TextRun({ text:sec.meta, font:SANS, size:16, color:'D9E2F0' }) ] }));
  return out;
}

const SHARED_OPTS = /^Only conclusion I follows$/;
function renderOptions(q){
  if (SHARED_OPTS.test(String(q.o[0]))) return [];   // legend given once in the directions
  const opts = q.o, hopts = q.oh;
  const flat = opts.map((o,i)=>`(${LETTERS[i]}) ${o}`).join('   ');
  const out = [];
  if (flat.length <= 88 && !hopts) {
    out.push(p(t(flat), { after:70, indent:{ left:300 } }));
  } else {
    opts.forEach((o,i) => {
      const runs = [ t(`(${LETTERS[i]}) `, { bold:true }), t(o) ];
      if (hopts && hopts[i] !== o) runs.push(t('   /   ' + hopts[i], { hindi:true, color:MUTE }));
      out.push(p(runs, { after: i===opts.length-1?70:10, indent:{ left:560, hanging:260 } }));
    });
  }
  return out;
}

function renderItems(items){
  const out = [];
  for (const it of items) {
    if (it.dir) {
      const eps = splitPara(it.en);
      eps.forEach((seg,i) => out.push(p(t(seg, { bold:true, size:18 }),
        { before: i===0?120:0, after: i<eps.length-1?20:(it.hi?10:80), indent:{left:100,right:100} })));
      if (it.hi) {
        const hps = splitPara(it.hi);
        hps.forEach((seg,i) => out.push(p(t(seg, { hindi:true, size:18, color:MUTE }),
          { after: i<hps.length-1?20:80, indent:{left:100,right:100} })));
      }
      continue;
    }
    if (it.passage) {
      it.passage.forEach(par => out.push(p(runs(par), { after:80, align:AlignmentType.JUSTIFIED, indent:{left:220,right:180} })));
      out.push(new Paragraph({ spacing:{after:60}, children:[] }));
      continue;
    }
    if (it.table) {
      const cols = it.table.head.length;
      const cw = Math.floor((USABLE*0.62)/cols);
      const widths = Array(cols).fill(cw); widths[cols-1] = Math.floor(USABLE*0.62) - cw*(cols-1);
      const mk = (txt, head, w) => new TableCell({ width:{size:w,type:WidthType.DXA},
        shading:{ type:ShadingType.CLEAR, fill: head?BAND:'FFFFFF', color:'auto' },
        margins:{ top:60, bottom:60, left:100, right:100 },
        borders:{ top:{style:BorderStyle.SINGLE,size:4,color:RULE}, bottom:{style:BorderStyle.SINGLE,size:4,color:RULE},
                  left:{style:BorderStyle.SINGLE,size:4,color:RULE}, right:{style:BorderStyle.SINGLE,size:4,color:RULE} },
        children:[ new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:0},
          children:[ new TextRun({ text:txt, font: /[ऀ-ॿ]/.test(txt)?HI:EN, size:18, bold:!!head }) ] }) ] });
      const rows = [ new TableRow({ tableHeader:true, children: it.table.head.map((h,i)=>mk(h,true,widths[i])) }) ];
      it.table.rows.forEach(r => rows.push(new TableRow({ children: r.map((c,i)=>mk(c,false,widths[i])) })));
      out.push(new Table({ width:{size:Math.floor(USABLE*0.62),type:WidthType.DXA}, columnWidths:widths,
        alignment:AlignmentType.CENTER, rows }));
      out.push(new Paragraph({ spacing:{after:120}, children:[] }));
      continue;
    }
    // question
    const optParas = renderOptions(it);
    const kn = optParas.length > 0;          // only chain to the options when there ARE options
    const eparts = it.en ? splitPara(it.en) : [''];
    const showHi = it.hi && String(it.hi).trim() !== String(it.en).trim();   // skip redundant Hindi (pure arithmetic)
    const head = [ t(`${it.n}.  `, { bold:true }) ];
    if (eparts[0]) head.push(...runs(eparts[0]));
    out.push(p(head, { before:60, after: eparts.length>1?20:(showHi?10:40), indent:{ left:300, hanging:300 }, keepNext: kn || eparts.length>1 || !!showHi }));
    eparts.slice(1).forEach((seg,i) => out.push(p(runs(seg),
      { after: i===eparts.length-2?(showHi?10:40):20, indent:{ left:300 },
        keepNext: kn || !!showHi || i < eparts.length-2 })));
    if (showHi) {
      const hparts = splitPara(it.hi);
      hparts.forEach((seg,i) => out.push(p(t(seg, { hindi:true, color:MUTE }),
        { after: i<hparts.length-1?20:40, indent:{ left:300 },
          keepNext: kn || i < hparts.length-1 })));
    }
    optParas.forEach(x => out.push(x));
  }
  return out;
}

// ---------- answer key ----------
function answerKey(all){
  const out = [];
  out.push(new Paragraph({ children:[ new PageBreak() ] }));
  out.push(p(t('ANSWER KEY  /  उत्तर कुंजी', { bold:true, size:26, color:ACCENT }), { after:40, align:AlignmentType.CENTER }));
  out.push(p(t('Bank Offline Speed Test — ST-01', { size:18, color:MUTE }), { after:160, align:AlignmentType.CENTER }));
  const cols = 10, cw = Math.floor(USABLE/cols);
  const widths = Array(cols).fill(cw); widths[cols-1] = USABLE - cw*(cols-1);
  const cell = (q,a,w) => new TableCell({ width:{size:w,type:WidthType.DXA},
    shading:{ type:ShadingType.CLEAR, fill:'FFFFFF', color:'auto' },
    margins:{ top:60, bottom:60, left:40, right:40 },
    borders:{ top:{style:BorderStyle.SINGLE,size:4,color:RULE}, bottom:{style:BorderStyle.SINGLE,size:4,color:RULE},
              left:{style:BorderStyle.SINGLE,size:4,color:RULE}, right:{style:BorderStyle.SINGLE,size:4,color:RULE} },
    children:[ new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:0}, children:[
        new TextRun({ text:`${q}. `, font:EN, size:17, color:MUTE }),
        new TextRun({ text:`(${a})`, font:EN, size:19, bold:true, color:ACCENT }) ] }) ] });
  const rows = [];
  for (let r=0; r<10; r++){
    const cells = [];
    for (let c=0; c<10; c++){ const n = r*10+c+1; cells.push(cell(n, LETTERS[all[n]], widths[c])); }
    rows.push(new TableRow({ children:cells }));
  }
  out.push(new Table({ width:{size:USABLE,type:WidthType.DXA}, columnWidths:widths, rows }));
  return out;
}

// ---------- solutions ----------
function solutions(){
  const out = [];
  out.push(new Paragraph({ children:[ new PageBreak() ] }));
  out.push(p(t('EXPLANATIONS  /  व्याख्या', { bold:true, size:26, color:ACCENT }), { after:160, align:AlignmentType.CENTER }));
  sections.forEach(sec => {
    out.push(p(t(sec.title.replace('SECTION','Section'), { bold:true, size:20, color:ACCENT }), { before:180, after:80 }));
    out.push(rule());
    sec.items.filter(i=>i.n).forEach(q => {
      out.push(p([ t(`${q.n}. `, { bold:true }), t(`(${LETTERS[q.ans]})  `, { bold:true, color:ACCENT }),
                   t(q.sol || '') ], { after:70, indent:{ left:380, hanging:380 } }));
    });
  });
  return out;
}

// ---------- assemble ----------
const allAnswers = {};
sections.forEach(s => s.items.filter(i=>i.n).forEach(q => allAnswers[q.n] = q.ans));

const body = [ ...masthead(), ...instructions() ];
sections.forEach((sec, i) => {
  if (i > 0) body.push(new Paragraph({ children:[ new PageBreak() ] }));
  renderSectionHeader(sec).forEach(x => body.push(x));
  renderItems(sec.items).forEach(x => body.push(x));
});
body.push(...answerKey(allAnswers));
body.push(...solutions());

const doc = new Document({
  creator:'Bank Offline ST-01', title:'Bank Offline Speed Test ST-01',
  description:'IBPS / SBI Clerk Prelims pattern speed test — 100 questions, 60 minutes, bilingual.',
  styles:{ default:{ document:{ run:{ font:EN, size:19, color:INK } } } },
  sections:[{
    properties:{ page:{ margin:{ top:1000, right:1083, bottom:1000, left:1083 } } },
    headers:{ default: new Header({ children:[ new Paragraph({ alignment:AlignmentType.RIGHT, spacing:{after:0},
        border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:RULE } },
        children:[ new TextRun({ text:'Bank Offline Speed Test — ST-01', font:SANS, size:15, color:MUTE }) ] }) ] }) },
    footers:{ default: new Footer({ children:[ new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:60},
        children:[ new TextRun({ text:'Page ', font:SANS, size:15, color:MUTE }),
                   new TextRun({ children:[PageNumber.CURRENT], font:SANS, size:15, color:MUTE }),
                   new TextRun({ text:' of ', font:SANS, size:15, color:MUTE }),
                   new TextRun({ children:[PageNumber.TOTAL_PAGES], font:SANS, size:15, color:MUTE }) ] }) ] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(process.argv[2] || 'Bank-Offline-ST-01.docx', buf);
  console.log('written:', process.argv[2], buf.length, 'bytes');
  console.log('questions:', Object.keys(allAnswers).length);
});
