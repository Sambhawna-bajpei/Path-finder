const mongoose=require("mongoose");

async function connectToDB(){
    try{
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
        console.log("Connected to MongoDB")
        return true;
    }catch(err){
        console.error("MongoDB connection failed:", err.message);
        return false;
    }
}

module.exports=connectToDB;
