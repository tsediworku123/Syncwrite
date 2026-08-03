import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import {Server} from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import {registerCollaborationHandlers} from "./sockets/collaboration.js";

const app=express();
const server=http.createServer(app);

app.use(cors({origin:process.env.CLIENT_ORIGIN,credentials:true}));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health",(req,res)=>res.json({ok:true}));
app.use("/api/auth",authRoutes);
app.use("/api/documents",documentRoutes);

// TODO: add rate limiting middleware
// TODO: add request logging

// generic error handler
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

const io=new Server(server,{
  cors:{origin:process.env.CLIENT_ORIGIN,credentials:true},
});
registerCollaborationHandlers(io);

const PORT=process.env.PORT||4000;
server.listen(PORT,()=>console.log(`SyncWrite API listening on :${PORT}`));
