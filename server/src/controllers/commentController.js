import {z} from "zod";
import {prisma} from "../config/prisma.js";

export async function listComments(req,res) {
  const comments=await prisma.comment.findMany({
    where:{documentId:req.params.id,deletedAt:null},
    include:{author:{select:{id:true,name:true,avatarColor:true}}},
    orderBy:{createdAt:"asc"},
  });
  res.json(comments);
}

const createSchema=z.object({
  body:z.string().min(1).max(2000),
  parentId:z.string().uuid().optional(),
  anchorFrom:z.number().int().optional(),
  anchorTo:z.number().int().optional(),
});

export async function createComment(req,res) {
  const parsed=createSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:"Comment body is required"});

  const comment=await prisma.comment.create({
    data:{
      documentId:req.params.id,
      authorId:req.user.id,
      ...parsed.data,
    },
    include:{author:{select:{id:true,name:true,avatarColor:true}}},
  });
  res.status(201).json(comment);
}

export async function resolveComment(req,res) {
  const comment=await prisma.comment.update({
    where:{id:req.params.commentId},
    data:{resolved:true},
  });
  res.json(comment);
}

export async function deleteComment(req,res) {
  const comment=await prisma.comment.findUnique({where:{id:req.params.commentId}});
  if(!comment) return res.status(404).json({error:"Comment not found"});
  // only author can delete
  if(comment.authorId!==req.user.id){
    return res.status(403).json({error:"You can only delete your own comments"});
  }
  await prisma.comment.update({where:{id:comment.id},data:{deletedAt:new Date()}});
  res.status(204).send();
}
