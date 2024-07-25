import { promises, existsSync, createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import PDFMerger from 'pdf-merger-js';
import { launch } from "puppeteer";



/**
 * pages = {
 *  page[1] : {start: [], end: []}
 * }
 */
let pages = {}
let pageCount = 0
let pageBuffCount = 1
let pageBuffers = {}
let minBufferSize = 250

const fileInput = "E:\\github publish\\NODE-PARSER\\assets\\template.html"


async function preCleanup() {
    const directories = ["E:\\github publish\\NODE-PARSER\\temp", "E:\\github publish\\NODE-PARSER\\result"];

    for (const directory of directories) {
        for (const file of await promises.readdir(directory)) {
            await promises.unlink(join(directory, file));
        }
    }
}


async function mergePdf(file1, file2) {
    var merger = new PDFMerger();

    await merger.add(file1);
    await merger.add(file2);

    await merger.save(file1);
}

async function prepForMerge() {
    const directory = "E:\\github publish\\NODE-PARSER\\result"
    const fileTemp = "E:\\github publish\\NODE-PARSER\\result\\temp-"
    let currFile = 1

    let initialFile = `${fileTemp}${currFile}.pdf`;

    while(currFile <= Math.round(pageCount / minBufferSize)){
        let nextFile = `${fileTemp}${currFile + 1}.pdf`

        if (existsSync(nextFile)) {
            console.log(initialFile, nextFile)
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
async function preProcessFile(fileInput) {
    const fileStream = createReadStream(fileInput);

    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let currLine = 1
    let pageSectionStart = 1
    let pageSectionEnd = 1
    let flag = false

    const pageStartRegex = new RegExp(".*<page>.*")
    const pageEndRegex = new RegExp(".*</page>.*")

    for await (const line of rl) {
        // console.log(`line : ${line}`)

        if (line.match(pageStartRegex)) {
            pageSectionStart = currLine
            flag = !flag

            // console.debug(`page start : ${pageSectionStart}`)
        }

        // reset flag and proceed to call the buffer to count the pages and store the line numbers
        if (line.match(pageEndRegex) && flag) {
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

async function createTree(fileInput, fileOutput, start, end) {
    var wrt = createWriteStream(fileOutput, {
        flags: 'a'
    })

    const fileStream = createReadStream(fileInput);
    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let currLine = 1

    for await (const line of rl) {
        // console.log(`line : ${line}`)
        if (currLine >= start && currLine <= end) {
            wrt.write(`${line}\n`)
        }
        currLine += 1
    }

    fileStream.close()
    wrt.close()

}

async function renderPDF(inputFile) {

    let buff = inputFile.split("\\")

    let newName = `${(buff[buff.length - 1]).split(".")[0]}.pdf`

    const bwsr = await launch({
        // headless: false,
        // defaultViewport: false,
    })
    let pg = (await bwsr.pages())[0]
    await pg.goto(inputFile, {
        waitUntil: 'domcontentloaded'
    })

    await pg.pdf({
        path: `E:\\github publish\\NODE-PARSER\\result\\${newName}`,
        format: "A4",
        landscape: true
    })

    bwsr.close()
}







async function main() {




    await preCleanup()
    await preProcessFile(fileInput)

    console.log("---- COMPLETED PROCESSING THE LINE NUMBERS -----")
    console.log(pages)
    console.log(pageCount)

    console.log(`total PDF needed to be compiled : ${Math.round(pageCount / minBufferSize)}`)

    let end = 1
    let start = 1

    while (pageBuffCount <= Math.round(pageCount / minBufferSize)) {
        if ((start + minBufferSize) > pageCount) {
            end = pageCount
        } else {
            end = start + minBufferSize - 1
        }

        pageBuffers[pageBuffCount] = {
            "start": pages[start].start,
            "end": pages[end].end
        }

        // console.log(pageBuffers[pageBuffCount])
        await createTree(fileInput, `E:\\github publish\\NODE-PARSER\\temp\\temp-${pageBuffCount}.html`, pages[start].start, pages[end].end)
        await renderPDF(`E:\\github publish\\NODE-PARSER\\temp\\temp-${pageBuffCount}.html`)

        console.log(`RENDERING : ${pageBuffCount}`)

        pageBuffCount += 1
        start = end + 1
    }

    console.log("----------- COMBINING PDF's -------------")
    await prepForMerge()

    // console.log(pageBuffCount)
}

main()