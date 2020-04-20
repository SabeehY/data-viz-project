library(tidyverse)
library(dplyr)
library(lubridate)

data <- read.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv")
deathData <- read.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_US.csv")
lookup <- read.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv")

reformatData <- function(data) {
  return(
    data %>%
      gather("date", "count",  names(data)[grepl("X", names(data))]) %>%
      filter(iso2 == "US", Lat != "0", Long_ != "0") %>% #Only include US and with lat long values
      #select(c(UID, FIPS, Admin2, Province_State ,Lat, Long_, date, count)) %>%
      select(UID, date, count) %>% # Select required
      mutate(date = str_replace_all(date, "X", "")) %>% # Fix date
      mutate(date = as.Date(date, format = "%m.%d.%y")) %>% # Parse date
      arrange(date) # sort by date
  )
}

df <- reformatData(data)
death <- reformatData(deathData)
lookup <- lookup %>%
  filter(!is.na(FIPS), code3 == 840) %>% # select only USA
  select(UID, Lat, Long_, FIPS) %>% # Select any attributes needed from lookup
  rename('lat' = Lat, 'lon' = Long_) # Rename for ease

df <- df %>% left_join(death, by=c("UID", "date")) %>%
  rename('case' = `count.x`, "death" = `count.y`)

## Group by week/day etc
# df <- group_by(df, UID, date=cut(date, "1 week")) %>%
#   summarise(case = sum(case), death=sum(death), lat=first(lat), lon=first(lon))  %>%
#   arrange(UID, date)

# add cumsum
df <- mutate(group_by(df,UID), case_cum=cumsum(case), death_cum=cumsum(death))

### Areas with case_cumsum > 1000
# filtered <- df %>%
#   group_by(UID) %>%
#   summarize(max = max(case_cum)) %>%
#   filter(max > 500)
#df <- filter(df, UID %in% filtered$UID)

# Add growth factor
df <- df %>%
      arrange(UID, date) %>%
      mutate(case_gf=case/lag(case), death_gf=death/lag(death))

formatGrowthFactors <- function(df, colName) {
  COL <- pull(df, colName)
  COL <- COL %>% replace_na(0) %>% round(3) # Change N/A to 0, this is when it is 0 after 0
  COL[is.infinite(COL)] <- 1 # Change infinite to 1, this when it goes up from 0 so percentge is undefined
  df[[colName]] <- COL
  return(df)
}

df <- formatGrowthFactors(df, "case_gf")
df <- formatGrowthFactors(df, "death_gf")

### After March
#df <- filter(df, date > "2020-03-01")

df <- arrange(df, date)
totals <- group_by(df, date) %>% summarize(case=sum(case), death=sum(death), case_cum=cumsum(case), death_cum=cumsum(death))

write_csv(lookup, '~/Documents/UCF/Study/Semester 2/CAP 6737 - Data Visualization/Group Project.tmp/lookup.csv')
write_csv(df, '~/Documents/UCF/Study/Semester 2/CAP 6737 - Data Visualization/Group Project.tmp/geo_cleaned.csv')
write_csv(totals, '~/Documents/UCF/Study/Semester 2/CAP 6737 - Data Visualization/Group Project.tmp/totals.csv')

#View(df)
