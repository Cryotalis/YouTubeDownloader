const { contextBridge } = require("electron")
const fs = require('fs')
const cp = require('child_process')
const ytdl = require('ytdl-core')
const ytpl = require('ytpl')
const ffmpegF = require('fluent-ffmpeg')
const ffmpegS = require('ffmpeg-static')

/**
 * Converts hours:minutes:seconds to seconds
 * @param {string} input - The duration in format hours:minutes:seconds
 */
function toSeconds(input){
    const hours = parseInt(input.match(/\d{2}(?=:)/))
    const minutes = parseInt(input.match(/(?<=\d{2}:)\d{2}/))
    const seconds = parseInt(input.match(/(?<=\d{2}:\d{2}:)\d{2}/))
    return hours * 60 * 60 + minutes * 60 + seconds
}

/**
 * Downloads YouTube videos.
 * @param {string} URL - The URL of the video
 * @param {string} format - The format/quality of the video
 * @param {string} downloadPath - The location to download the video to
 */
async function downloadVideo(URL, format, downloadPath = `${process.env.USERPROFILE}/Downloads`){
    const info = await ytdl.getInfo(URL)
    const title = fileFormat(info.videoDetails.title)
    const ID = info.videoDetails.videoId
    const length = info.videoDetails.lengthSeconds
    const audio = ytdl.downloadFromInfo(info, {quality: 'highestaudio'})

    spawnProgBar(ID, title)
    /** Handle duplicate file names */
    downloadPath += `/${title}`
    if (fs.existsSync(`${downloadPath}.mp3`) || fs.existsSync(`${downloadPath}.mp4`)){
        let i = 1
        while(fs.existsSync(`${downloadPath} (${i}).mp3`) || fs.existsSync(`${downloadPath} (${i}).mp4`)) i++
        downloadPath += ` (${i})`
    }

    if (format === 'mp3'){
        ffmpegF.setFfmpegPath('./ffmpeg/bin/ffmpeg.exe')
        ffmpegF(audio).audioBitrate(128).save(`${downloadPath}.mp3`)
        .on('progress', ({timemark}) => {
            const progress = Math.ceil(toSeconds(timemark)/length*100).toFixed(0)
            updateProgBar(ID, progress)
        })
        .on('end', () => {
            removeFade(document.getElementById(ID), 1.5, 2)                    
            setTimeout(() => {
                if (!document.getElementById('progressBox').hasChildNodes()) document.getElementById('progressBox').style.opacity = 0  
            }, 5000) 
        })
    } else {
        const formats = info.formats.filter(f => f.container === 'mp4' && f.hasAudio === false)
        const video = ytdl.downloadFromInfo(info, {quality: formats.find(f => f.qualityLabel === `${format}60` || f.qualityLabel === format).itag})
        
        // Start the ffmpeg child process
        const ffmpegProcess = cp.spawn(ffmpegS, [
            // Remove ffmpeg's console spamming
            '-loglevel', '8', '-hide_banner',
            // Redirect/Enable progress messages
            '-progress', 'pipe:3',
            // Set inputs
            '-i', 'pipe:4',
            '-i', 'pipe:5',
            // Map audio & video from streams
            '-map', '0:a',
            '-map', '1:v',
            // Keep encoding
            '-c:v', 'copy',
            // Define output file
            `${downloadPath}.mp4`,
        ], {
            windowsHide: true,
            stdio: [
            /* Standard: stdin, stdout, stderr */
            'inherit', 'inherit', 'inherit',
            /* Custom: pipe:3, pipe:4, pipe:5 */
            'pipe', 'pipe', 'pipe',
            ],
        })
        audio.pipe(ffmpegProcess.stdio[4])
        video.pipe(ffmpegProcess.stdio[5])
    }
}

async function downloadPlaylist(URL, format){
    const playlist = await ytpl(String(URL.match(/(?<=list=).+?(?=&|$)/) || URL)).catch(err => {
        console.log('This playlist either does not exist or is private.')
    })
    if (!playlist) return
    const playlistName = fileFormat(playlist.title)

    /** Handle duplicate folder names */
    let downloadPath = `${process.env.USERPROFILE}/Downloads/${playlistName}`
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath)
    } else {
        let i = 1
        while(fs.existsSync(`${downloadPath} (${i})`)) i++
        downloadPath += ` (${i})`
        fs.mkdirSync(downloadPath)
    }

    for (let i = 0; i < playlist.items.length; i++){
        downloadVideo(playlist.items[i].shortUrl, format, downloadPath)
    }
}

/**
 * Replaces illegal file name characters in a string.
 * @param {string} input - The string to be formatted
 */
 function fileFormat(input){
    return input
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, "''")
        .replace(/"/g, "''")
        .replace(/\|/g, '⏐')
        .replace(/\?/g, '？')
        .replace(/\\/g, '⧵')
        .replace(/\//g, '∕')
        .replace(/:/g, 'ː')
        .replace(/\*/g, '⁎')
        .replace(/</g, '﹤')
        .replace(/>/g, '﹥')
}

/**
 * Create a progress bar for the given video
 * @param {string} ID - The ID of the video
 * @param {string} title - The Title of the video
 */
function spawnProgBar(ID, title){
    const progbox = document.getElementById('progressBox')
    progbox.innerHTML += 
    `<div id="${ID}" class="block"> \
        <p>${title}</p> \
        <progress class="progress is-info is-small" max="100"></progress> \
    </div>`
}

/**
 * Update the progress bar for the given video
 * @param {string} ID - The ID of the video
 * @param {string} value - The percentage of the video that has been downloaded
 */
function updateProgBar(ID, value){
    const progblock = document.getElementById(ID)
    progblock.lastElementChild.setAttribute('value', value)
}

/**
 * Remove an element with a fade out effect
 * @param {HTMLElement} element - The element to be removed
 * @param {number} delay - The number of seconds to delay before starting to remove the element, in seconds
 * @param {number} speed - The speed with which to remove the element, in seconds
 */
function removeFade(element, delay, speed){
    setTimeout(() => {
        element.style.transition = `opacity ${speed}s ease`
        element.style.opacity = 0
        setTimeout(() => {
            element.parentNode.removeChild(element)
        }, speed*1000)
    }, delay*1000)
}

function delay(seconds){
    return new Promise(resolve => setTimeout(resolve, seconds*1000))
}

const API = {
    download: (format) => {
        const youtubeURL = document.getElementById('youtubeURL').value
        if (/list=/.test(youtubeURL)) downloadPlaylist(youtubeURL, format)
        else downloadVideo(youtubeURL, format)
    }
}

contextBridge.exposeInMainWorld("api", API)