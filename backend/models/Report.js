import mongoose from 'mongoose';
const reportSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},originalName:{type:String,required:true},fileName:{type:String,required:true},mimeType:String,size:Number,reportType:String,status:{type:String,enum:['draft','saved'],default:'draft',index:true},savedAt:Date,extractedText:{type:String,select:false},extraction:{type:Object},analysisVersion:String,analysis:{type:Object,required:true}},{timestamps:true});
reportSchema.index({user:1,status:1,createdAt:-1});
export default mongoose.model('Report',reportSchema);
