import {z} from "zod";
import {prisma} from "../config/prisma.js";
import {hashPassword,verifyPassword,signToken} from "../utils/auth.js";

const registerSchema=z.object({
  name:z.string().min(2).max(80),
  email:z.string().email(),
  password:z.string().min(8,"Password must be at least 8 characters"),
});

const loginSchema=z.object({
  email:z.string().email(),
  password:z.string().min(1),
});

const COOKIE_OPTS={
  httpOnly:true,
  sameSite:"lax",
  secure:process.env.NODE_ENV==="production",
  maxAge:7*24*60*60*1000, // 7 days
};

const AVATAR_COLORS=["#6366f1","#ec4899","#22c55e","#f59e0b","#0ea5e9","#a855f7"];

export async function register(req,res) {
  const parsed=registerSchema.safeParse(req.body);
  if(!parsed.success){
    return res.status(400).json({error:parsed.error.issues[0].message});
  }
  const {name,email,password}=parsed.data;

  const existing=await prisma.user.findUnique({where:{email}});
  if(existing){
    return res.status(409).json({error:"An account with that email already exists"});
  }

  const passwordHash=await hashPassword(password);
  const avatarColor=AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)];

  const user=await prisma.user.create({
    data:{name,email,passwordHash,avatarColor},
  });

  // Don't auto-login - just return success message
  res.status(201).json({message:"Account created successfully"});
}

export async function login(req,res) {
  const parsed=loginSchema.safeParse(req.body);
  if(!parsed.success){
    return res.status(400).json({error:"Email and password are required"});
  }
  const {email,password}=parsed.data;

  const user=await prisma.user.findUnique({where:{email}});
  if(!user||!(await verifyPassword(password,user.passwordHash))){
    return res.status(401).json({error:"Invalid email or password"});
  }

  const token=signToken({sub:user.id,name:user.name,email:user.email});
  res.cookie("token",token,COOKIE_OPTS);
  res.json(publicUser(user));
}

export async function logout(req,res) {
  res.clearCookie("token",{...COOKIE_OPTS,maxAge:undefined});
  res.status(204).send();
}

export async function me(req,res) {
  const user=await prisma.user.findUnique({where:{id:req.user.id}});
  if(!user) return res.status(404).json({error:"User not found"});
  res.json(publicUser(user));
}

function publicUser(user){
  return {id:user.id,name:user.name,email:user.email,avatarColor:user.avatarColor};
}
