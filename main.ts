import puppeteer from "puppeteer";
import { askStartingNumber, authenticateSkit, autoEntry, verifyPhoneNumbers } from "./helpers";

const startingNumber = await askStartingNumber();
if (!startingNumber) {
    console.log("Invalid starting number");
    process.exit(1);
}

// opens a browser
const browser = await puppeteer.launch({ headless: false });
let page = await browser.newPage();

// authenticate and verify phone numbers in whatsapp
const verifiedNumbers: number[] | undefined = await verifyPhoneNumbers({ page, startingNumber });

if (!verifiedNumbers) {
    console.log("Failed to get the numbers");
    process.exit(1);
}

// authenticating to skit and verifying the numbers
const skitAuth = await authenticateSkit({ page, browser });
console.log(skitAuth)
if (!skitAuth) {
    console.log("Failed to authenticate to skit");
    process.exit(1);
}

// verifying the numbers
const automationResults = await autoEntry({ page, verifiedNumbers, browser });

console.log(automationResults)

// closing the browser
await browser.close();
