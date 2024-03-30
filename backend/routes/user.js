const express = require("express")
const zod = require("zod")
const {User, Account} = require("../db");
const jwt = require("jsonwebtoken");
const {JWT_SECRET} = require("../config");
const {authMiddleware} = require("../middleware");

const router = express.Router();

const signupBody = zod.object({
    username: zod.string().email(),
    firstName: zod.string(),
    lastName: zod.string(),
    password: zod.string()
})


router.post("/signUp", async(req, res) => {

    const obj = signupBody.safeParse(req.body);

    if(!obj.success){
        return res.status(411).json({
            message: "Email already taken / Incorrect inputs"
        })
    }

    const existingUser = await User.findOne({
        username: req.body.username
    })

    if(existingUser){
        return res.status(411).json({
            message: "Email already taken/Incorrect inputs"
        })
    }

    const user = await User.create({
        username: req.body.username,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
    })

    const userId = user._id;

    await Account.create({
        userId,
        balance: 1+ Math.random()*10000
        
    })
    const token = jwt.sign({
        userId
    }, JWT_SECRET);

    res.json({

        message: "user created successufully",
        token: token
    })

})

const signinBody = zod.object({
    username: zod.string().email(),
	password: zod.string()
})

router.post("/signin", async(req, res) => {
    const {success} = signinBody.safeParse(req.body);
    if(!success){
        return res.status(411).json({
            message: "Incorrect inputs"
        })
    }

    const user = await User.findOne({
        username: req.body.Username,
        password: req.body.password

    })

    if(user){
        const token = jwt.sign({
            userId: user._id
        }, JWT_SECRET)

        res.json({
            token: token
        })

        return;
    }

    res.status(411).json({
        message: "Error while logging in"
    })


})

const updateBody = zod.object({
    password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
})

router.put("/", authMiddleware, async(req, res) => {
    const {success} = updateBody.safeParse(req.body)
    if(!success){
        res.status(411).json({
            message: "Error while updating information"
        })
    }

    await User.updateOne(req.body, {
        _id: req.userId
    })

    res.json({
        message: "Updated successfully"
    })
})

router.get("/bulk", async(req, res) => {
    const filter = req.query.filter || "";
    const users = await User.find({
        $or: [{
            firstName: {
                "$regex": filter
            }   
        }, {
            lastName: {
                "$regex": filter
            }
        }]
    })

    res.json({
        user: users.map(user => ({
            username: user.username, 
            firstName: user.firstName,
            lastName: user.lastName, 
            _id: user._id
        }))
    })
})

router.get("/balance", authMiddleware, async(req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    })

    res.json({
        balance: account.balance
    })
})

router.post("/transfer", authMiddleware, async(req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const{amount, to} = req.body;

    const account = await Account.findOne({userId: req.userId}).session(session);

    if(!account || account.balance<amount){
        await session.abortTransaction();
        return res.status(400).json({
            message: "Insufficient balance"
        })
    }

    await Account.updateOne({userId: req.userId}, {$inc: {balance: -amount} }).session(session);
    await Account.updateOne({userId: to}, {$inc: {balance: amount}}).session(session);

    await session.commitTransaction();
    res.json({
        message: "Transfer successful"
    })
})

module.exports = router;