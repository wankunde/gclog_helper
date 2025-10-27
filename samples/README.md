# JDK8 

本程序只支持带有 PrintGCDateStamps 参数的日志解析

`-Xloggc:/tmp/gc.log`: [jdk8_parallelGC.log](jdk8_parallelGC.log)
`-XX:+UseG1GC -Xloggc:/tmp/gc.log`: [jdk8_G1GC.log](jdk8_G1GC.log)
`-XX:+UseG1GC -XX:+PrintGCDateStamps -Xloggc:/tmp/gc.log`: [jdk8_G1GC_timestamp.log](jdk8_G1GC_timestamp.log)
`-XX:+UseG1GC -XX:+PrintGCDateStamps -XX:+PrintGCTimeStamps -Xloggc:/tmp/gc.log`: []()

* -XX:+PrintGCTimeStamps	打印 相对时间戳，表示从 JVM 启动到 GC 发生 的秒数	12.345: [GC (Allocation Failure) ...]
* -XX:+PrintGCDateStamps	打印 绝对时间戳（系统日期时间）	2025-10-27T18:42:16.345+0800: [GC (Allocation Failure) ...]

# JDK25

`-Xlog:gc`: [jdk25_G1GC.log](jdk25_G1GC.log)
`-Xlog:gc*:file=/tmp/gc.log:time,uptime,level,tags`: [jdk25_G1GC_timestamp.log](jdk25_G1GC_timestamp.log)


| 功能         | JDK 8 参数                  | JDK 9+ 参数                        |
| ---------- | ------------------------- | -------------------------------- |
| 打印详细 GC 日志 | `-XX:+PrintGCDetails`     | `-Xlog:gc*`                      |
| 打印时间戳      | `-XX:+PrintGCTimeStamps`  | 默认包含在 `-Xlog` 输出中                |
| 打印日期       | `-XX:+PrintGCDateStamps`  | `-Xlog:gc*:time`                 |
| 打印堆变化      | `-XX:+PrintHeapAtGC`      | `-Xlog:gc+heap=debug`            |
| 输出到文件      | `-Xloggc:/path/to/gc.log` | `-Xlog:gc*:file=/path/to/gc.log` |
