import * as Y from "yjs";
import {prisma} from "../config/prisma.js";

export async function listVersions(req,res) {
  const versions = await prisma.documentVersion.findMany({
    where:{documentId:req.params.id},
    include:{createdBy:{select:{id:true,name:true,avatarColor:true}}},
    orderBy:{createdAt:"desc"},
  });
  res.json(
    versions.map(v=>({
      id:v.id,
      preview:v.plainTextPreview,
      createdAt:v.createdAt,
      createdBy:v.createdBy,
    }))
  );
}

// restore old version - creates snapshot first so we don't lose current state
export async function restoreVersion(req,res) {
  const {id:documentId,versionId}=req.params;

  const version=await prisma.documentVersion.findUnique({where:{id:versionId}});
  if(!version||version.documentId!==documentId){
    return res.status(404).json({error:"Version not found"});
  }

  const current=await prisma.document.findUnique({where:{id:documentId}});

  // save current state before restoring
  await prisma.$transaction([
    prisma.documentVersion.create({
      data:{
        documentId,
        createdById:req.user.id,
        snapshot: current.ydocState??Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())),
        plainTextPreview:"Snapshot before restore",
      },
    }),
    prisma.document.update({
      where:{id:documentId},
      data:{ydocState:version.snapshot},
    }),
  ]);

  res.json({restored:true,versionId});
}
