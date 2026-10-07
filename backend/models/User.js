import mongoose from 'mongoose';
export const WATER_REMINDER_INTERVALS=[30,60,120,180,240];
const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},password:{type:String,minlength:6,required(){return !this.googleId}},googleId:{type:String,unique:true,sparse:true},role:{type:String,enum:['patient','doctor'],default:'patient'},phone:String,dateOfBirth:Date,age:{type:Number,min:1,max:120},gender:{type:String,enum:['','Female','Male','Non-binary','Prefer not to say'],default:''},bloodGroup:{type:String,enum:['A+','A-','B+','B-','AB+','AB-','O+','O-','']},height:Number,weight:Number,emergencyContact:String,address:String,medicalConditions:String,profilePicture:String,
// Notifications need browser permission, so they start off until the user turns them on in Settings.
settings:{healthNotifications:{type:Boolean,default:false},waterReminders:{enabled:{type:Boolean,default:false},intervalMinutes:{type:Number,enum:WATER_REMINDER_INTERVALS,default:120}},language:{type:String,enum:['en','te'],default:'en'},darkMode:{type:Boolean,default:false}},
// Server-side scheduling state for the drink-water push; never sent to the client.
waterReminderNextAt:{type:Date,select:false,index:true}},{timestamps:true});
export default mongoose.model('User',userSchema);
