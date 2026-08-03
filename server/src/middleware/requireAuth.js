import {verifyToken} from "../utils/auth.js";

// check if user is authenticated via JWT cookie
export function requireAuth(req,res,next){
  const token=req.cookies?.token;
  if(!token){
    return res.status(401).json({error:"Not authenticated"});
  }
  try{
    const payload=verifyToken(token);
    req.user={id:payload.sub,name:payload.name,email:payload.email};
    next();
  }catch(err){
    // console.log('auth error:',err);
    return res.status(401).json({error:"Invalid or expired session"});
  }
}
