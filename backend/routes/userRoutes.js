import {Router} from 'express';import multer from 'multer';import path from 'path';import {fileURLToPath} from 'url';import auth from '../middleware/auth.js';import {getProfile,removeProfilePicture,updateProfile,updateSettings,uploadProfilePicture} from '../controllers/userController.js';
const uploadsDirectory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../uploads');
const MAX_PHOTO_BYTES=3*1024*1024;
// Extension comes from the validated MIME type, never from the client's file name.
const photoExtensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
const storage=multer.diskStorage({destination:uploadsDirectory,filename:(req,file,cb)=>cb(null,`avatar-${req.user._id}-${Date.now()}${photoExtensions[file.mimetype]}`)});
const imageUpload=multer({storage,limits:{fileSize:MAX_PHOTO_BYTES,files:1},fileFilter:(req,file,cb)=>photoExtensions[file.mimetype]?cb(null,true):cb(Object.assign(new Error('Only JPG, PNG and WEBP profile photos are allowed'),{status:400}))});
// Turn multer failures into clear 400 responses instead of the generic report-upload messages.
function profilePhotoUpload(req,res,next){imageUpload.single('picture')(req,res,error=>{if(!error)return next();if(error.code==='LIMIT_FILE_SIZE')return res.status(400).json({message:'Profile photo must be smaller than 3 MB'});if(error instanceof multer.MulterError)return res.status(400).json({message:'Upload a single JPG, PNG or WEBP photo in the "picture" field'});next(error)})}
const router=Router();router.use(auth);router.get('/profile',getProfile);router.put('/profile',updateProfile);router.put('/settings',updateSettings);router.post('/profile-picture',profilePhotoUpload,uploadProfilePicture);router.delete('/profile-picture',removeProfilePicture);export default router;
