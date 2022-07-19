function showFormats(){
    document.getElementById('formats').classList.toggle('show')
}

window.onclick = function(event) {
    if (event.target.matches('.dropbutton')) return
    let dropdowns = document.getElementsByClassName("dropdown-content")
    for (let i = 0; i < dropdowns.length; i++) {
        if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show')
    }
}

function downloadYT(format){
    window.api.download(format)
    const progbox = document.getElementById('progressBox')
    progbox.style.opacity = 1
}