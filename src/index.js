import { promises, createReadStream, createWriteStream, existsSync, mkdirSync, exists } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { launch } from "puppeteer";
import { execSync } from 'child_process';
console.time()



// GLOBAL PATH DECLARATION
let ASSET_ROOT = `${process.cwd()}/assets`
let TEMP_ROOT = `${process.cwd()}/temp`
let RESULT_ROOT = `${process.cwd()}/result`




// Global settings
let pages = {}
let pageCount = 0
let pageBuffCount = 1
let pageBuffers = {}
let globalSettingsBuffer = []
let MIN_PAGE_BUFFER = 500
let TEMPLATE_FILE = `${ASSET_ROOT}/template.html`



// Check if the provided directories exist / Or proceed to create
function validateDirPath(sysPath){
    if(!(existsSync(sysPath))){
        mkdirSync(sysPath)
    }
}

//override debug log
if(process.argv.indexOf("--verbose") < 0){
    // disable logging debug
    console.debug = function () { }
}

// overriding global variables through CLI
for (const args of process.argv.slice(2)) {
    console.debug(args)
    
    let buffer = args.split("=")

    switch (buffer[0]) {
        case "--root":
            console.debug("ROOT", buffer[1])
            break

        // HARD CHECKS
        case "--asset-root":
            console.debug("ASSET ROOT", buffer[1])
            if(!existsSync(buffer[1].replace(/\\/g, "/"))){
                throw new Error("Provide a valid assets path")
            }
            ASSET_ROOT = buffer[1].replace(/\\/g, "/")
            break


        // SOFT CHECKS
        case "--temp-root":
            console.debug("TEMP ROOT", buffer[1])
            TEMP_ROOT = buffer[1].replace(/\\/g, "/")
            validateDirPath(TEMP_ROOT)
            break
        
        case "--result-root":
            console.debug("RESULT ROOT", buffer[1])
            RESULT_ROOT = buffer[1].replace(/\\/g, "/")
            validateDirPath(RESULT_ROOT)
            break

        case "--template-file":
            console.debug("Template file", buffer[1])
            TEMPLATE_FILE = (existsSync(buffer[1].replace(/\\/g, "/"))) ? buffer[1].replace(/\\/g, "/") : TEMPLATE_FILE
            break

        case "--min-page-buffer":
            console.debug("MIN PAGE BUFFER", buffer[1])
            MIN_PAGE_BUFFER = (Number.isInteger(Number.parseInt(buffer[1]))) ? Number.parseInt(buffer[1]) : MIN_PAGE_BUFFER
    }
}

// OVERVIEW
console.log("OPTION OVERVIEW")
console.table({
    TEMPLATE_FILE : TEMPLATE_FILE,
    RESULT_ROOT : RESULT_ROOT,
    ASSET_ROOT : ASSET_ROOT,
    TEMP_ROOT : TEMP_ROOT,
    MIN_PAGE_BUFFER : MIN_PAGE_BUFFER
})


/**
 * Cleanup all the existing dump from previous generation
 */
async function preCleanup() {
    validateDirPath(TEMP_ROOT)
    validateDirPath(RESULT_ROOT)

    const directories = [TEMP_ROOT, RESULT_ROOT];
    for (const directory of directories) {
        for (const file of await promises.readdir(directory)) {
            await promises.unlink(join(directory, file));
        }
    }


}


/**
 * Merge the PDF files generated
 * @param {String} file1
 * @param {String} file2 
 * @returns 
 */
function mergePdf(file1, file2) {
    return new Promise((resolve, reject) => {
        try {
            // As to support the python pip package (Does not support "\\"" path seperators)
            file1 = file1.replace(/\\/g, "/")
            file2 = file2.replace(/\\/g, "/")

            const command = `node ${process.cwd()}\\node_modules\\@condorhero\\merge-pdfs\\bin\\merge-pdfs.mjs ${file1} ${file2} -o ${file1}`
            console.debug(command)

            const child = execSync(command)
            console.debug(child.toString())

            resolve(true)
        } catch (error) {
            reject(error.toString())
        }
    })
}

/**
 * Perform merge operation with the initial file (TEMP-1)
 * Calls {@link mergePdf}
 */
async function prepForMerge() {
    const pdfResultBuffer = `${RESULT_ROOT}/temp-`
    let currFile = 1

    let initialFile = `${pdfResultBuffer}${currFile}.pdf`;

    while (currFile <= Math.round(pageCount / MIN_PAGE_BUFFER)) {
        let nextFile = `${pdfResultBuffer}${currFile + 1}.pdf`

        if (existsSync(nextFile)) {
            console.debug(initialFile, nextFile)
            await mergePdf(initialFile, nextFile)

            // to perform cleanup
            await promises.unlink(nextFile);
        }
        currFile += 1
    }
}




/**
 * PRE PROCESS THE FILE
 * pre-processes the files and stores the page section start and end to global  
 * {@link pages}
 */
async function preProcessFile(TEMPLATE_FILE) {
    const fileStream = createReadStream(TEMPLATE_FILE);

    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })



    // To avoid iteration of html and repetative tags across the pages in the template-base
    const pageGlobalSettingsStart = new RegExp(".*<globalsettings>.*")
    const pageGlobalSettingsEnd = new RegExp(".*</globalsettings>.*")
    let globalSettingFlag = false

    // Identifiers to index the pages
    const pageStartRegex = new RegExp(".*<page>.*")
    const pageEndRegex = new RegExp(".*</page>.*")


    let currLine = 1
    let pageSectionStart = 1
    let pageSectionEnd = 1
    let flag = false

    for await (const line of rl) {
        // console.debug(`line : ${line}`)

        // WRITING BUFFERS TO TEMP VARIABLE TO REPLICATE ON EVERY PAGE OF TEMPLATE HTML'S
        if (line.match(pageGlobalSettingsStart)) {
            globalSettingFlag = !globalSettingFlag
        } else if (line.match(pageGlobalSettingsEnd)) {
            globalSettingFlag = !globalSettingFlag
        }

        if (globalSettingFlag && !(line.match(pageGlobalSettingsStart))) {
            globalSettingsBuffer.push(line)
        }



        // INDEXING THE START AND END SECTIONS
        if (line.match(pageStartRegex)) {
            pageSectionStart = currLine
            flag = !flag

            // console.debug(`page start : ${pageSectionStart}`)
        }

        // reset flag and proceed to call the buffer to count the pages and store the line numbers
        else if (line.match(pageEndRegex) && flag) {
            pageCount += 1
            pageSectionEnd = currLine
            flag = !flag


            pages[pageCount] = {
                "start": pageSectionStart,
                "end": pageSectionEnd
            }

            // console.debug(`page start : ${pageSectionEnd}`)
        }

        currLine += 1

    }

    fileStream.close()
}


/**
 * 
 * @param {String} TEMPLATE_FILE Template HTML file to work with
 * @param {String} fileOutput Location of the template file after generation (After split)
 * @param {Number} start Starting line number in {@link TEMPLATE_FILE}
 * @param {Number} end Ending line number in {@link TEMPLATE_FILE}
 */
async function createTree(TEMPLATE_FILE, fileOutput, start, end) {
    var wrt = createWriteStream(fileOutput, {
        flags: 'a'
    })

    const fileStream = createReadStream(TEMPLATE_FILE);
    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let currLine = 1

    // WRITING GLOBAL SETTINGS
    for (const line of globalSettingsBuffer) {
        wrt.write(line)
    }


    for await (const line of rl) {
        // console.debug(`line : ${line}`)
        if (currLine >= start && currLine <= end) {
            wrt.write(`${line}\n`)
        }
        currLine += 1
    }

    fileStream.close()
    wrt.close()

}


/**
 * Generates a PDF FILE for the provided HTML File
 * @param {String} inputFile Location of HTML File
 */
async function renderPDF(inputFile) {

    let buff = inputFile.split("\\")

    let newName = `${(buff[buff.length - 1]).split(".")[0]}.pdf`

    const bwsr = await launch({
        // headless: false,
        // defaultViewport: false,
        executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    })
    let pg = (await bwsr.pages())[0]
    await pg.goto(inputFile, {
        waitUntil: 'domcontentloaded'
    })

    await pg.pdf({
        path: `${process.cwd()}\\result\\${newName}`,
        format: "A4",
        landscape: true,
        printBackground: true,
        outline: true
    })

    bwsr.close()
}


/**
 * MAIN FUNCTION - ENTRY
 */
async function main() {
    console.time("INDEXING")

    await preCleanup()
    await preProcessFile(TEMPLATE_FILE)


    console.log("-------------------- INDEXING COMPLETE --------------------")
    console.debug(pages)
    console.log(`Total pages : ${pageCount}`)
    console.log(`total PDF needed to be compiled : ${Math.round(pageCount / MIN_PAGE_BUFFER)}`)

    console.timeLog("INDEXING")


    let end = 1
    let start = 1

    console.time("HTML RENDER")
    while (pageBuffCount <= Math.round(pageCount / MIN_PAGE_BUFFER)) {
        if ((start + MIN_PAGE_BUFFER) > pageCount) {
            end = pageCount
        } else {
            end = start + MIN_PAGE_BUFFER - 1
        }

        /**Performs grouping and re-indexes the start and end */
        pageBuffers[pageBuffCount] = {
            "start": pages[start].start,
            "end": pages[end].end
        }

        // console.log(pageBuffers[pageBuffCount])
        await createTree(TEMPLATE_FILE, `${process.cwd()}\\temp\\temp-${pageBuffCount}.html`, pages[start].start, pages[end].end)
        await renderPDF(`${process.cwd()}\\temp\\temp-${pageBuffCount}.html`)

        console.debug(`RENDERING : ${pageBuffCount}`)

        pageBuffCount += 1
        start = end + 1
    }

    console.log("---------------- RENDERING HTML COMPLETE ----------------")
    console.timeLog("HTML RENDER")

    console.log("---------------- COMBINING PDF's ----------------")
    console.time("PDF MERGE")
    await prepForMerge()
    console.timeLog("PDF MERGE")

    // console.log(pageBuffCount)
}



// MAIN CALL
main().then(() => {
    console.timeEnd()
}).catch((err)=>{
    console.error(err)

    console.log("\n\n---------------------------------------------------------------\n\n")
    console.log("Execution stopped due to error in main level, Please contact Author")
    console.log("Or raise an issue / bug in the repository")
    console.log("https://github.com/saran-surya/NODE-PDF-LFS/issues")
})

// test
// mergePdf("D:/NODE-PDF-LFS/result/temp-1.pdf", "D:/NODE-PDF-LFS/result/temp-2.pdf").catch((err)=>{
//     console.log(err)
// })
