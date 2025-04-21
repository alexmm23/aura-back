import { Router } from "express";

import { getAllUsers } from '../services/user.service.js';


export const userRouter = Router();

userRouter.get('/', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});