import fs from 'fs/promises';import path from 'path';import {fileURLToPath} from 'url';import Report from '../models/Report.js';import {randomUUID} from 'crypto';import {analyzeReport} from '../services/reportAnalysis.js';import {buildDashboardSummary} from '../services/dashboardSummary.js';import {NOTIFICATIONS,sendToUser} from '../services/pushService.js';
const uploadsDirectory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../uploads');
async function removeStoredFile(fileName){if(!fileName)return;const target=path.resolve(uploadsDirectory,path.basename(fileName));if(target.startsWith(`${uploadsDirectory}${path.sep}`))await fs.unlink(target).catch(()=>{})}
export async function uploadReport(req,res,next){
  if(!req.file)return res.status(400).json({message:'Please select a report'});
  const requestId=randomUUID();
  try{
    const buffer=await fs.readFile(req.file.path);
    const previous=await Report.find({user:req.user._id,status:'saved','analysis.engineVersion':{$exists:true},'analysis.score':{$ne:null}}).sort({createdAt:-1}).limit(5).select('analysis.score createdAt').lean();
    const previousScores=previous.reverse().map(r=>({name:new Date(r.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),score:r.analysis.score}));
    const {analysis,extractedText,extraction}=await analyzeReport({buffer,mimeType:req.file.mimetype,requestId,previousScores});
    console.info(`[report:${requestId}] user=${req.user._id} file=${req.file.filename} method=${extraction.method} chars=${extraction.characters} values=${extraction.valuesFound} findings=${analysis.possibleConditions.length} ai=${analysis.aiExplanation.used?'gemini':'rules-only'}`);
    const report=await Report.create({user:req.user._id,originalName:req.file.originalname,fileName:req.file.filename,mimeType:extraction.fileType||req.file.mimetype,size:req.file.size,reportType:analysis.reportType,status:'draft',extractedText,extraction,analysisVersion:analysis.engineVersion,analysis});
    // Health notifications: push to the user's browsers; the service worker only shows it when HealthNova is not the visible tab.
    const notificationPushed=req.user.settings?.healthNotifications?await sendToUser(req.user._id,NOTIFICATIONS.report(report._id)).then(n=>n>0,()=>false):false;
    res.status(201).json({message:analysis.insufficientInformation?'Report uploaded, but no readable values were found':'Report uploaded and analyzed',reportId:report._id,report,notificationPushed});
  }catch(e){
    await removeStoredFile(req.file.filename);
    if(e.status===422)return res.status(422).json({message:e.message});
    next(e);
  }
}
// Dashboard numbers for the authenticated user only (user id always comes from the JWT, never from the request).
export async function reportSummary(req,res,next){try{const fields='originalName status savedAt createdAt analysis.score analysis.engineVersion analysis.prediction analysis.riskLevel analysis.measurements.status';const [saved,latestDraft]=await Promise.all([Report.find({user:req.user._id,$or:[{status:'saved'},{status:{$exists:false}}]}).select(fields).lean(),Report.findOne({user:req.user._id,status:'draft'}).sort({createdAt:-1}).select(fields).lean()]);res.json(buildDashboardSummary({saved,latestDraft}))}catch(e){next(e)}}
export async function listReports(req,res,next){try{res.json(await Report.find({user:req.user._id,$or:[{status:'saved'},{status:{$exists:false}}]}).sort({savedAt:-1,createdAt:-1}))}catch(e){next(e)}}
export async function getReport(req,res,next){try{const report=await Report.findOne({_id:req.params.id,user:req.user._id}).select('+extractedText');if(!report)return res.status(404).json({message:'Report not found'});res.json(report)}catch(e){next(e)}}
export async function saveReport(req,res,next){try{const report=await Report.findOne({_id:req.params.id,user:req.user._id});if(!report)return res.status(404).json({message:'Report not found'});if(report.status!=='saved'){report.status='saved';report.savedAt=new Date();await report.save()}res.json({message:'Report saved',report})}catch(e){next(e)}}
export async function deleteReport(req,res,next){try{const report=await Report.findOneAndDelete({_id:req.params.id,user:req.user._id});if(!report)return res.status(404).json({message:'Report not found'});await removeStoredFile(report.fileName);res.json({message:'Report deleted'})}catch(e){next(e)}}
