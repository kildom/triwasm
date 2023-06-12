
function collapse(instrElement) {
    console.log(instrElement);
    let block = instrElement.parentElement.lastElementChild;
    if (block.style.display == 'none') {
        block.style.display = '';
        instrElement.style.textDecoration = '';
        instrElement.style.fontWeight = '';
    } else {
        block.style.display = 'none';
        instrElement.style.textDecoration = 'line-through';
        instrElement.style.fontWeight = 'bold';
    }
}

function goToBlockTop(event) {
    let block = event.target; 
    let rect = block.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    event.cancelBubble = true;
    console.log(x, y, event);
    if (x < 10) {
        //document.getElementById('').offsetTop
        window.scrollTo({top: block.parentElement.offsetTop});
        console.log(window.scrollY, rect.top);
    }
}
