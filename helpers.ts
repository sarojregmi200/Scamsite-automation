import { Browser, Page } from "puppeteer";

import {
    XpathPrefix,
    authenticationUrl,
    breakWhatsappCheckAt,
    dataEntryUrl,
    emailFeildXpath,
    foundContactXpath,
    loginUserId,
    loginUserPassword,
    notFoundContactXpath,
    passwordFeildXpath,
    searchBoxXpath,
} from "./Constants";

import chalk from "chalk";

export async function closeBrowser(browser: Browser) {
    await browser.close();
}

export async function authenticateScamSite({ page }: { page: Page, browser: Browser }): Promise<boolean> {
    await page.goto(authenticationUrl, { timeout: 0 });

    try {
        console.log(chalk.yellow("Authenticating to Scam site"));

        // locating and entering email
        const emailFeild = await page.waitForSelector(
            XpathPrefix + emailFeildXpath,
            { timeout: 0 }
        );
        if (!emailFeild) throw new Error("No email feild found");
        await emailFeild.type(loginUserId);
        console.log(chalk.white("Email entered ..."));

        // entering password
        const passwordFeild = await page.waitForSelector(
            XpathPrefix + passwordFeildXpath,
            { timeout: 0 }
        );
        if (!passwordFeild) throw new Error("No password feild found");
        await passwordFeild.type(loginUserPassword);
        console.log(chalk.white("Password entered ..."));

        await Promise.all([
            passwordFeild.press("Enter"),
            page.waitForNavigation({ timeout: 0 })
        ]);

        console.log(chalk.green("Authentication Successfull !!!"));
        return true;
    } catch (error) {
        console.log(chalk.bgRed(error));
        return false;
    }
}

export async function autoEntry(
    { page, verifiedNumbers, browser, amountOfNumbers }: { verifiedNumbers: number[], browser: Browser, page: Page, amountOfNumbers: number },
) {
    try {
        await page.goto(dataEntryUrl, { waitUntil: "load", timeout: 0 });
        let verifiedCount = 0;

        browser.on("targetcreated", async (target) => {
            if (target.type() === "page") {
                const newPage = await target.page();
                await newPage?.close();

                console.log(chalk.blue("Popup closed"));
            }
        })

        for (let i = 1; i <= amountOfNumbers; i++) {
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

            await Promise.all([
                whatsAppIcon?.click(),
                page.waitForNetworkIdle({ timeout: 0 }),
            ]);

            // checking if the number is verified
            if (phnumber && verifiedNumbers.includes(parseInt(phnumber))) {
                console.log(`Verifying ${phnumber}`);
                // clicking the verify button.
                const verifyBtn = await columns[3]?.waitForSelector("button", { timeout: 0 });
                if (!verifyBtn) {
                    console.log(chalk.red("No verify button found"));
                    continue;
                }

                await Promise.all([
                    verifyBtn.click(),
                    page.waitForNetworkIdle({ timeout: 0 }),
                ]);
                verifiedCount++;
                console.log(chalk.green(`Confirmed Verified Numbers ${verifiedCount}`));
                await sleep(15);
            }
            else {
                // clicking the delete btn;
                const deleteBtn = await columns[4]?.waitForSelector("button", { timeout: 0 });
                if (!deleteBtn) {
                    console.log(chalk.red("No delete button found"));
                    continue;
                }

                console.log(chalk.red(`Deleting ${phnumber}`));

                await Promise.all([
                    deleteBtn.click(),
                    page.waitForNetworkIdle({ timeout: 0 }),
                ]);
                await page.waitForNavigation({ waitUntil: "load", timeout: 0 });
            }
        }
    } catch (e) {
        console.log(chalk.red("caught error", e));
    }
}

export async function authenticateWAPP({ page }: { page: Page }) {
    try {
        await page.goto("https://web.whatsapp.com/", {
            waitUntil: "load",
            timeout: 0
        });
        const authenticated = await page.waitForSelector(XpathPrefix + searchBoxXpath, {
            timeout: 0,
        });

        if (!authenticated) throw new Error("Authentication failed");

        console.log(chalk.green("Authenticated to whatsapp!!"));
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

export async function askAmountOfNumbersToVerify() {
    const prompt = "Enter the amount of Numbers you want to verify.";
    process.stdout.write(prompt);

    const amountOfNumbers = await new Promise<string>((resolve) => {
        process.stdin.on("data", (data) => {
            resolve(data.toString().trim());
        });
    });
    if (amountOfNumbers)
        return parseInt(amountOfNumbers);
}


export async function verifyPhoneNumbers(
    { page, startingNumber, amountOfNumbers }: { page: Page, startingNumber: number, amountOfNumbers: number },
): Promise<number[] | undefined> {
    const verifiedNumbers: number[] = []

    // authenticating
    console.log(chalk.yellow("Authenticating to whatsapp!!"));
    const whatsappAuth = await authenticateWAPP({ page });
    if (!whatsappAuth) return;

    console.log(chalk.white("Searching for the search box"));
    const searchBox = await page.waitForSelector(XpathPrefix + searchBoxXpath,
        { timeout: 0 }
    );
    await page.waitForNetworkIdle();

    if (!searchBox) return;
    await searchBox.click();

    let currentNumber = startingNumber;
    let verifiedCount = 0;
    let itteration = 0;

    // for one time there are only 1000 numbers
    while (itteration <= amountOfNumbers) {
        itteration++;
        const phoneNumber = "+" + currentNumber;
        // verifying numbers
        await searchBox.type(phoneNumber);

        await sleep(2);
        let result = await Promise.race([
            await page.waitForSelector(XpathPrefix + foundContactXpath, {
                timeout: 0,
            }),
            await page.waitForSelector(XpathPrefix + notFoundContactXpath, {
                timeout: 0,
            })
        ]);

        // // holds for 2 second just in case
        // await sleep(2);

        console.log("Searching in result contianer")
        const numberDoesnotExist = await result?.evaluate((doc) => {
            if (!doc) return false;
            const textContent = doc.textContent;
            if (!textContent) return;

            return textContent.includes("No results found for");
        })

        console.log(`current number: ${currentNumber.toString().replace(/......../, "*********")} 
                ${numberDoesnotExist ? chalk.red("donesnot Exists") : chalk.green("Exists")}`)

        if (!numberDoesnotExist) {
            verifiedNumbers.push(currentNumber)
            verifiedCount++;
            console.log(chalk.green(`Verified numbers: ${verifiedCount}\n`))
        }
        currentNumber++;

        // await searchBox.click();
        await page.keyboard.down("Control");
        await searchBox.press("a");
        await page.keyboard.up("Control");

        await searchBox.press("Backspace");

        // holding for 1 minute every 20 itterations, just incase whatsapp,
        // thinks we are a bot
        if (itteration % breakWhatsappCheckAt === 0) {
            console.log(chalk.bgYellow("Holding for 1 minute"));
            await sleep(60);
        }
    }
    return verifiedNumbers;
}

export async function sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
