import { TryCatch } from "../utils/TryCatch.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sql } from "../utils/db.js";
import getBuffer from "../utils/buffer.js";
import Jwt from "jsonwebtoken"
import bcrypt from "bcrypt";
import axios from "axios";
import { publishToTopic } from "../producer.js";
import { redisClient } from "../index.js";
import { forgotPasswordTemplate } from "../template.js";

export const registerUser=TryCatch(async(req ,res ,next)=>{
    const {email,name,password,phoneNumber,role,bio}=req.body;
    if(!name||!email||!password||!phoneNumber||!role||!bio){
        throw new ErrorHandler(400,"please fill all details");
    }
    const existingUsers=await sql `
    SELECT user_id FROM users WHERE email=${email}
    `;
    if(existingUsers.length>0){
        throw new ErrorHandler(400,"user already exists");
    }
    const hashPassword=await bcrypt.hash(password,10);
    let registerdUser;
    if(role==="recruiter"){
        const[user]=await sql `
        INSERT INTO users(name,email,password,phone_number,role) VALUES(${name},${email},${hashPassword},${phoneNumber},${role})RETURNING
        user_id,name,email,phone_number,role,created_at
        `;
        registerdUser=user;
    }
    else if(role==="jobseeker"){
        const file=req.file ;
        if(!file){
            throw new ErrorHandler(400,"Resume file is required for jobseekers");
        }
        const fileBuffer=getBuffer(file);
        if(!fileBuffer||!fileBuffer.content){
            throw new ErrorHandler(500,"failed to generate buffer");
        }
        const {data}=await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`,{buffer:fileBuffer.content})
       const[user]=await sql `
        INSERT INTO users(name,email,password,phone_number,role,resume,resume_public_id) VALUES(${name},${email},${hashPassword},${phoneNumber},${role},${data.url},${data.public_id})RETURNING
        user_id,name,email,phone_number,role,resume,created_at
        `;
        registerdUser=user; 
    }
    const token=Jwt.sign({id:registerdUser?.user_id},
        process.env.JWT_SEC as string,{
            expiresIn:"15d"
        }
    );
    res.json({
        message:"user registered successfullly",
        registerdUser,
        token
    })
})

export const loginUser=TryCatch(async(req,res,next)=>{
const {email,password}=req.body;
if(!email||!password){
    throw new ErrorHandler(400,"please fill all details");
}
const user=await sql`
SELECT u.user_id,u.name,u.email,u.password,u.phone_number,u.role,u.bio,u.resume,u.profile_pic,
u.subscription,ARRAY_AGG(s.name) FILTER (where s.name IS NOT NULL) as skills FROM users u LEFT JOIN user_skills us ON u.user_id=us.user_id
LEFT JOIN skills s ON us.skill_id=s.skill_id
WHERE u.email=${email}
GROUP BY u.user_id;
`;
if(user.length===0){
    throw new ErrorHandler(400,"Invalid credentails");
}
const userObject=user[0];
if (!userObject) {
    throw new ErrorHandler(400, "Invalid credentials");
}

const matchPassword=await bcrypt.compare(password,userObject.password);
if(!matchPassword){
    throw new ErrorHandler(400,"invalid credentails");
}
userObject.skills=userObject.skills||[];
delete userObject.password;

    const token=Jwt.sign({id:userObject?.user_id},
        process.env.JWT_SEC as string,{
            expiresIn:"15d"
        }
    );
    if (!token) {
    throw new ErrorHandler(400,"Token missing");
}

    res.json({
        message:"user LoggedIn successfullly",
        userObject,
        token
    })

})

export const forgotPassword=TryCatch(async(req,res ,next)=>{
    const{email}=req.body;
    if(!email){
        throw new ErrorHandler(400,"email is required");
    }
    const users=await sql `
    SELECT user_id,email FROM users WHERE email=${email};
    `;
    if(users.length===0){
        return res.json({
            message:"If that email exists,we have sent a reset link",
        })
    }
    const user=users[0];
    if (!user) {
    throw new ErrorHandler(400, "User not found");
}

    const resetToken=Jwt .sign(
        {
            email:user.email,
            type:"reset",
        },
        process.env.JWT_SEC as string,
        {expiresIn:"15m"}
    )
    const resetLink=`${process.env.Frontend_Url}/reset/${resetToken}`;
    await redisClient.set(`forgot:${email}`,resetToken,{
        EX:900,
    })
    const message={
        to:email,
        subject:"Reset Your Password-hireheaven",
        html:forgotPasswordTemplate(resetLink),
    };
    publishToTopic("send-mail",message);
    res.json({
        message:"IF that mail exists,we have sent a reset link",
    })
})


export const resetPassword = TryCatch(async (req, res, next) => {
    const token = req.params.token as string;
    const { password } = req.body;

    if (!token) {
        throw new ErrorHandler(400, "Token missing");
    }

    let decoded: any;

    try {
        decoded = Jwt.verify(
            token,
            process.env.JWT_SEC as string
        );
    } catch {
        throw new ErrorHandler(400, "Expired token");
    }

    // rest of code...
});