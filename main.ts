import puppeteer from "puppeteer";
import { askAmountOfNumbersToVerify, askStartingNumber, authenticateScamSite, autoEntry, verifyPhoneNumbers } from "./helpers";
import chalk from "chalk";
import { defaultAmountOfNumbers } from "./Constants";

const startingNumber = await askStartingNumber();
if (!startingNumber) {
    console.log("Invalid starting number");
    process.exit(1);
}

let amountOfNumbers = await askAmountOfNumbersToVerify();
if (!amountOfNumbers) {
    console.log("Invalid amount of Numbers");
    amountOfNumbers = defaultAmountOfNumbers;
}

// opens a browser
const browser = await puppeteer.launch({ headless: false });
let page = await browser.newPage();

// authenticate and verify phone numbers in whatsapp
const verifiedNumbers: number[] | undefined = await verifyPhoneNumbers({ page, startingNumber, amountOfNumbers });

if (!verifiedNumbers) {
    console.log(chalk.red("Failed to get the numbers"));
    process.exit(1);
}

// authenticating to scam site and verifying the numbers
const scamAuth = await authenticateScamSite({ page, browser });
console.log(scamAuth)
if (!scamAuth) {
    console.log(chalk.red("Failed to authenticate to Scam Site"));
    process.exit(1);
}

// verifying the numbers
await autoEntry({ page, verifiedNumbers, browser, amountOfNumbers });


// closing the browser
await browser.close();
