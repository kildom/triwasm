# Callbacks

Callbacks are functions
implemented by the host and called by the guest. Unlike `import` functions, they
are not visible in the guest-host interface, but they are provided by the host
to gest, for example, as a function parameters.
