-- CreateTable
CREATE TABLE "Calendar" (
    "d" DATETIME NOT NULL,
    "dayofweek" INTEGER NOT NULL,
    "weekday" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL
);

INSERT
  OR ignore INTO "Calendar" (d, dayofweek, weekday, quarter, year, month, day)
SELECT *
FROM (
  WITH RECURSIVE dates(d) AS (
    VALUES('2022-01-01')
    UNION ALL
    SELECT date(d, '+1 day')
    FROM dates
    WHERE d < '2100-01-01'
  )
  SELECT d,
    (CAST(strftime('%w', d) AS INT) + 6) % 7 AS dayofweek,
    CASE
      (CAST(strftime('%w', d) AS INT) + 6) % 7
      WHEN 0 THEN 'Monday'
      WHEN 1 THEN 'Tuesday'
      WHEN 2 THEN 'Wednesday'
      WHEN 3 THEN 'Thursday'
      WHEN 4 THEN 'Friday'
      WHEN 5 THEN 'Saturday'
      ELSE 'Sunday'
    END AS weekday,
    CASE
      WHEN CAST(strftime('%m', d) AS INT) BETWEEN 1 AND 3 THEN 1
      WHEN CAST(strftime('%m', d) AS INT) BETWEEN 4 AND 6 THEN 2
      WHEN CAST(strftime('%m', d) AS INT) BETWEEN 7 AND 9 THEN 3
      ELSE 4
    END AS quarter,
    CAST(strftime('%Y', d) AS INT) AS year,
    CAST(strftime('%m', d) AS INT) AS month,
    CAST(strftime('%d', d) AS INT) AS day
  FROM dates
);


-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_calendar_1" ON "Calendar"("d");
Pragma writable_schema=0;
