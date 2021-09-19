
#![no_main]

use std::str;

fn message(msg: &str) {
    extern {
        fn _message(msg: *const u8, len: u32);
    }    
    unsafe {
        _message(msg.as_ptr(), msg.len() as u32);
    }
}

// Following example will use heap making output binary grow significantly
/*
fn message2(msg: &str) {
    use std::os::raw::c_char;
    use std::ffi::CString;
    extern {
        fn _message2(msg: *const c_char);
    }    
    unsafe {
        let s = CString::new(msg).expect("CString::new failed");
        _message2(s.as_ptr());
    }
}
*/

#[no_mangle]
pub extern "C" fn entry() {
    message("Hello World");
    //message2("Hello World");
}

/* Comments:
Embedded Rust Book may be useful:
    https://docs.rust-embedded.org/book/

#![no_std] may reduce code size, but have some limitations.

Rust assumes stack first and zero global-base, so there is no need for --global-base, because
the value can be added to stack size and the result is the same.
*/
