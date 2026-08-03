import {z} from "zod";
import {prisma} from "../config/prisma.js";

export async function listShares(req,res) {
  const shares = await prisma.documentShare.findMany({
    where: {documentId: req.params.id},
    include: {user: {select: {id:true, name:true, email:true, avatarColor:true}}},
  });
  res.json(shares.map(s=>({id:s.id,role:s.role,user:s.user})));
}

const shareSchema=z.object({
  email: z.string().email(),
  role: z.enum(["VIEWER","COMMENTER","EDITOR"]),
});

export async function upsertShare(req,res) {
  const parsed=shareSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Valid email and role are required"});

  const {email,role}=parsed.data;
  const doc=await prisma.document.findUnique({where:{id:req.params.id}});
  if(!doc) return res.status(404).json({error:"Document not found"});

  const targetUser=await prisma.user.findUnique({where:{email}});
  if(!targetUser) return res.status(404).json({error:"No user with that email"});
  if(targetUser.id===doc.ownerId){
    return res.status(400).json({error:"Document owner already has full access"});
  }

  const share=await prisma.documentShare.upsert({
    where:{documentId_userId:{documentId:doc.id,userId:targetUser.id}},
    update:{role},
    create:{documentId:doc.id,userId:targetUser.id,role},
  });
  res.status(201).json(share);
}

export async function removeShare(req,res) {
  await prisma.documentShare.deleteMany({
    where:{documentId:req.params.id,userId:req.params.userId},
  });
  res.status(204).send();
}
