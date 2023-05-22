// No standard stuff - keep the bytecode small
#![no_std]
#![no_main]

// Using

extern crate alloc;
use alloc::borrow::ToOwned;
use core::str;
use linked_list_allocator::LockedHeap;

// Things that should be provided for "no_std"

#[global_allocator]
static ALLOCATOR: LockedHeap = LockedHeap::empty();

#[panic_handler]
fn my_panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

// The message function wrapper.
// Converts rust string to null-terminated C string.

fn message(msg: &str) {
    extern "C" {
        fn message(msg: *const u8);
    }
    let mut buffer = msg.as_bytes().to_owned();
    buffer.push(0);
    unsafe {
        message(buffer.as_ptr());
    }
}

// Exported entry point

#[no_mangle]
pub extern "C" fn entry() {
    message("Hello World");
}
