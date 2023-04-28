import { Router } from "express";
// import * as orderController from "./controllers/orderController";
// import * as tradeController from "./controllers/tradeController";
// import * as twController from "./controllers/twController";

const router = Router();

router.get("/", (req, res) => res.send("Server is alive 👌"));


export { router };
