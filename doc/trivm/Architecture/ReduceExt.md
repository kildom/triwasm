
### REDUCE

 * Encoding A
   ```
   ..., [R words to remove], [K words to keep], value1 →
   ..., [K words to keep]
   ```
   ```
   K = value1 >> 16
   R = value1 & 0xFFFF
   ```
 * Encoding B (`value1` is taken from the instruction immiediate)
   ```
   ..., [R words to remove], [K words to keep] →
   ..., [K words to keep]
   ```
   ```
   K = (value1 >> 4) & 0xF
   R = value1 & 0xF
   ```
 * Encoding C (`value1` is taken from the instruction immiediate)
   ```
   ..., [R words to remove], [K words to keep] →
   ..., [K words to keep]
   ```
   ```
   K = (value1 >> 8) & 0xFF
   R = value1 & 0xFF
   ```
 * Encoding D (`value1` is taken from the instruction immiediate)
   ```
   ..., [R words to remove], [K words to keep] →
   ..., [K words to keep]
   ```
   ```
   K = (value1 >> 16) & 0xFFFF
   R = value1 & 0xFFFF
   ```
Operation:
```
```

