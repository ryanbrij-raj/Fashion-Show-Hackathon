import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { Vonage } from '@vonage/server-sdk';

const app = express(); app.use(cors()); app.use(express.json({limit:'20mb'}));
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
let videoSessionId = null;

const mockInventory = [
  {id:'mock-1',name:'Black bomber jacket',category:'outerwear',color:'black',emoji:'🧥'},
  {id:'mock-2',name:'White Oxford shirt',category:'top',color:'white',emoji:'👔'},
  {id:'mock-3',name:'Blue straight jeans',category:'bottom',color:'blue',emoji:'👖'},
  {id:'mock-4',name:'White sneakers',category:'shoes',color:'white',emoji:'👟'}
];

app.get('/health', (_,res)=>res.json({ok:true, gemini:!!ai}));

app.post('/api/closet/scan', async (req,res) => {
  try {
    if (!ai) return res.json({inventory: mergeInventory(req.body.existingInventory || [], mockInventory), demo:true});
    const image = parseDataUrl(req.body.image);
    const prompt = `You are cataloging a wardrobe from one camera frame. Return ONLY valid JSON: {"items":[{"name":"specific short name","category":"top|bottom|outerwear|dress|shoes|accessory|other","color":"dominant color","pattern":"solid/striped/etc","emoji":"one relevant emoji"}]}. Identify clearly visible wearable items only. Avoid duplicates within the frame.`;
    const result = await ai.models.generateContent({model:MODEL, contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:image.mimeType,data:image.data}}]}]});
    const parsed = safeJson(result.text);
    const fresh = (parsed.items || []).map((x,i)=>({...x,id:`${slug(x.name)}-${Date.now()}-${i}`}));
    res.json({inventory: mergeInventory(req.body.existingInventory || [], fresh)});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/chat', async (req,res) => {
  try {
    const {message, inventory=[], selectedItem, history=[], styleMode='Adaptive', trendLens='Current'} = req.body;
    if (!ai) return res.json({text:`Demo mode: I'd style ${selectedItem?.name || 'your selected piece'} with items already in your closet. Add GEMINI_API_KEY for real recommendations.`});
    const prompt = `You are Closet Co-Shopper, a sharp fashion stylist with strong color-theory knowledge. Active style direction: ${styleMode}. Trend lens: ${trendLens}. You MUST recommend owned items only when the user asks what they already own. Inventory: ${JSON.stringify(inventory)}. Selected item: ${JSON.stringify(selectedItem)}. Recent conversation: ${JSON.stringify(history)}. User: ${message}. Use concrete fashion reasoning: hue relationships (complementary/analogous/monochrome), value contrast, saturation, neutral anchors, silhouette/proportion, texture, and occasion. Never blindly match colors. Give a confident answer under 140 words. Mention exact inventory item names when useful. Never invent owned items.`;
    const result = await ai.models.generateContent({model:MODEL,contents:prompt});
    res.json({text:result.text});
  } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/buy-check', async (req,res)=>{
  try{
    if(!ai) return res.json({text:'Demo verdict: BUY IF it creates at least 3 distinct outfits and is not a near-duplicate of something you own.'});
    const image=parseDataUrl(req.body.image);
    const prompt=`Act as a brutally useful closet-aware shopping advisor with expert color-theory and styling knowledge. Style direction: ${req.body.styleMode || 'Adaptive'}. Trend lens: ${req.body.trendLens || 'Current'}. Existing inventory: ${JSON.stringify(req.body.inventory || [])}. Analyze the pictured potential purchase. Return a short verdict starting with BUY, SKIP, or MAYBE. Then include: Closet compatibility /100; how many existing items it plausibly pairs with; duplication risk; 2 exact owned items it would pair with when possible. Do not pretend to know price or fabric unless visible.`;
    const result=await ai.models.generateContent({model:MODEL,contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:image.mimeType,data:image.data}}]}]});
    res.json({text:result.text});
  }catch(e){res.status(500).json({error:e.message});}
});



app.post('/api/try-on', async (req,res)=>{
  try{
    if(!ai) return res.status(400).json({error:'Gemini API key is required for virtual try-on.'});
    const body=parseDataUrl(req.body.bodyImage);
    const garment=parseDataUrl(req.body.garmentImage);
    const interaction=await ai.interactions.create({
      model:IMAGE_MODEL,
      input:[
        {type:'image',mime_type:body.mimeType,data:body.data},
        {type:'image',mime_type:garment.mimeType,data:garment.data},
        {type:'text',text:`Create a realistic virtual fashion try-on. The FIRST image is the person/base photo. The SECOND image is the garment to try on. Preserve the person's identity, face, body proportions, pose, hair, background, camera angle, and lighting. Replace only the relevant clothing region with the garment from the second image, adapting drape, folds, scale, shadows, and perspective naturally. Do not beautify, reshape, or change the person's body. Do not add accessories unless present in the garment image. Style direction: ${req.body.styleMode || 'Adaptive'}. Return one photorealistic full-body result.`}
      ],
      response_format:{type:'image',mime_type:'image/jpeg',image_size:'1K'}
    });
    const out=interaction.output_image;
    if(!out?.data) throw new Error('Image model returned no preview');
    res.json({image:`data:${out.mime_type || 'image/jpeg'};base64,${out.data}`});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/video/session', async (_,res)=>{
  try{
    const appId=process.env.VONAGE_APPLICATION_ID, path=process.env.VONAGE_PRIVATE_KEY_PATH;
    if(!appId || !path) return res.status(400).json({error:'Vonage env vars not configured'});
    const vonage = new Vonage({applicationId:appId, privateKey:fs.readFileSync(path)});
    if(!videoSessionId){ const s=await vonage.video.createSession({}); videoSessionId=s.sessionId || s.session_id || s; }
    const token=vonage.video.generateClientToken(videoSessionId,{role:'publisher'});
    res.json({applicationId:appId,sessionId:videoSessionId,token});
  }catch(e){res.status(500).json({error:e.message});}
});

function parseDataUrl(url=''){const m=url.match(/^data:(.*?);base64,(.*)$/);if(!m)throw new Error('Invalid image');return{mimeType:m[1],data:m[2]}}
function safeJson(t=''){const s=t.replace(/```json|```/g,'').trim(); return JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));}
function slug(s='item'){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)}
function mergeInventory(existing,fresh){const out=[...existing];for(const item of fresh){const key=`${item.category}|${item.color}|${String(item.name).toLowerCase()}`;if(!out.some(x=>`${x.category}|${x.color}|${String(x.name).toLowerCase()}`===key))out.push(item)}return out.slice(0,60)}

app.listen(process.env.PORT || 8787,()=>console.log(`API on http://localhost:${process.env.PORT || 8787}`));
