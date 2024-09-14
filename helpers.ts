import { Browser, Page } from "puppeteer";
import {
    XpathPrefix,
    authenticationUrl,
    breakWhatsappCheckAt,
    dataEntryUrl,
    emailFeildXpath,
    loginUserId,
    loginUserPassword,
    numbersToVerify,
    passwordFeildXpath,
    searchBoxXpath,
} from "./Constants";

export async function closeBrowser(browser: Browser) {
    await browser.close();
}

export async function authenticateSkit({ page }: { page: Page, browser: Browser }): Promise<boolean> {
    await page.goto(authenticationUrl, { timeout: 0 });

    try {
        console.log("Authenticating ...");

        // locating and entering email
        const emailFeild = await page.waitForSelector(
            XpathPrefix + emailFeildXpath,
        );
        if (!emailFeild) throw new Error("No email feild found");
        await emailFeild.type(loginUserId);
        console.log("email done...");

        // entering password
        const passwordFeild = await page.waitForSelector(
            XpathPrefix + passwordFeildXpath,
        );
        if (!passwordFeild) throw new Error("No password feild found");
        await passwordFeild.type(loginUserPassword);
        console.log("Password done...");

        await Promise.all([
            passwordFeild.press("Enter"),
            page.waitForNavigation({ timeout: 0 })
        ]);

        console.log("Login sucessfull");
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}


export async function autoEntry(
    { page, verifiedNumbers, browser }: { verifiedNumbers: number[], browser: Browser, page: Page, },
): Promise<number> {
    try {
        await page.goto(dataEntryUrl, { waitUntil: "load", timeout: 0 });
        let verifiedCount = 0;

        browser.on("targetcreated", async (target) => {
            if (target.type() === "page") {
                const newPage = await target.page();
                await newPage?.close();

                console.log("Popup closed");
            }
        })

        for (let i = 1; i <= numbersToVerify; i++) {
            // getting the 2nd table
            const [, table] = await page.$$("table");
            if (!table) throw new Error("No table found");

            // getting the table rows
            const firstRow = await table.$("tbody tr");
            if (!firstRow) throw new Error("No row found");

            // looping through each row
            const columns = await firstRow.$$("td");
            if (!columns) throw new Error("No columns found");

            // getting the phone number
            let phnumber = await page.evaluate((node) => node?.innerText, columns[1]);
            if (!phnumber) throw new Error("No phone number found");

            phnumber = phnumber.trim().replace("+", "");

            // clicking the whatsappicon
            const whatsAppIcon = await columns[2].$("a");
            if (!whatsAppIcon) throw new Error("No whatsapp Icon found");
            console.log("clicking the whatsappIcon");

            await Promise.all([
                whatsAppIcon?.click(),
                page.waitForNetworkIdle({ timeout: 0 }),
            ]);

            // checking if the number is verified
            if (phnumber && verifiedNumbers.includes(parseInt(phnumber))) {
                console.log(`Verifying ${phnumber}`);
                // clicking the verify button.
                const verifyBtn = await columns[3]?.waitForSelector("button");
                if (!verifyBtn) {
                    console.log("No verify button found");
                    continue;
                }

                await Promise.all([
                    verifyBtn.click(),
                    page.waitForNetworkIdle({ timeout: 0 }),
                ]);
                verifiedCount++;
                console.log(`Confirmed Verified Numbers ${verifiedCount}`);
            }
            else {
                console.log(`Skipping ${phnumber}`);
                // clicking the delete btn;
                const deleteBtn = await columns[4]?.waitForSelector("button");
                if (!deleteBtn) {
                    console.log("No delete button found");
                    continue;
                }

                console.log(`Deleting ${phnumber}`);

                await Promise.all([
                    deleteBtn.click(),
                    page.waitForNetworkIdle({ timeout: 0 }),
                ]);
            }

            await page.waitForNavigation({ waitUntil: "load" });
        }

    } catch (e) {
        console.log("caught error", e);
    }

    return 0;
}

export async function authenticateWAPP({ page }: { page: Page }) {
    try {
        await page.goto("https://web.whatsapp.com/", { waitUntil: "load" });
        const authenticated = await page.waitForSelector(XpathPrefix + searchBoxXpath, {
            timeout: 0,
        });

        if (!authenticated) throw new Error("Authentication failed");

        console.log("Authenticated to whatsapp...");
        return true;
    }
    catch (e) {
        console.log(e);
        return false;
    }
}

export async function askStartingNumber() {
    const prompt = "What is the starting phoneNumber? without +: ";
    process.stdout.write(prompt);

    const startingNumber = await new Promise<string>((resolve) => {
        process.stdin.on("data", (data) => {
            resolve(data.toString().trim());
        });
    });
    if (startingNumber)
        return parseInt(startingNumber);
}

export async function verifyPhoneNumbers(
    { page, startingNumber }: { page: Page, startingNumber: number },
): Promise<number[] | undefined> {
    const verifiedNumbers: number[] = []

    // authenticating
    console.log("Authenticating to whatsapp...");
    const whatsappAuth = await authenticateWAPP({ page });
    if (!whatsappAuth) return;

    console.log("searching for the search box");
    const searchBox = await page.waitForSelector(".lexical-rich-text-input");
    if (!searchBox) return;
    await searchBox.click();

    let currentNumber = startingNumber;
    let verifiedCount = 0;
    let itteration = 0;

    // for one time there are only 1000 numbers
    while (itteration <= numbersToVerify) {
        itteration++;
        const phoneNumber = "+" + currentNumber;
        // verifying numbers
        await searchBox.type(phoneNumber);
        await searchBox.press("Enter");

        // holds for 2 second just in case
        await sleep(2);

        const numberDoesnotExist = await page.evaluate(() => {
            console.log("Checking if the number exists");
            return document.body.innerHTML.toString().includes("No chats, contacts or messages found") ? true : false
        })

        console.log(`current number: ${currentNumber} ${numberDoesnotExist
            ? "donesnot Exists" : "Exists"}`)

        if (!numberDoesnotExist) {
            verifiedNumbers.push(currentNumber)
            verifiedCount++;
            console.log(`Verified numbers: ${verifiedCount}`)
        }
        currentNumber++;

        // clear the searchbox
        await searchBox.click();
        await page.keyboard.down("Control");
        await searchBox.press("Backspace");
        await searchBox.press("Backspace");
        await page.keyboard.up("Control");

        // holding for 1 minute every 20 itterations, just incase whatsapp,
        // thinks we are a bot
        if (itteration % breakWhatsappCheckAt === 0) {
            console.log("Holding for 1 minute");
            await sleep(60);
        }
    }
    return verifiedNumbers;
}

export async function sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
