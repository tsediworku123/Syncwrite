import {prisma} from "../config/prisma.js";

// Role hierarchy for comparison purposes.
const ROLE_RANK={VIEWER:1,COMMENTER:2,EDITOR:3};

// figure out what role the user has on a document
export async function getEffectiveRole(userId,documentId){
  const doc=await prisma.document.findUnique({
    where:{id:documentId},
    select:{ownerId:true,deletedAt:true},
  });
  if(!doc||doc.deletedAt) return null;
  if(doc.ownerId===userId) return "OWNER";

  const share=await prisma.documentShare.findUnique({
    where:{documentId_userId:{documentId,userId}},
  });
  return share?.role??null;
}

export function hasAtLeast(role,minRole){
  if(role==="OWNER") return true;
  if(!role) return false;
  return ROLE_RANK[role]>=ROLE_RANK[minRole];
}

// middleware to check if user has required role
export function requireDocRole(minRole){
  return async(req,res,next)=>{
    const documentId=req.params.id||req.params.documentId;
    const role=await getEffectiveRole(req.user.id,documentId);
    if(!role) return res.status(404).json({error:"Document not found"});
    if(!hasAtLeast(role,minRole)){
      return res.status(403).json({error:"Insufficient permissions"});
    }
    req.docRole=role;
    next();
  };
}
