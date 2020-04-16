library(tidyverse)
library(dplyr)
library(lubridate)

data <- read.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv")

df <- data %>%
  gather("date", "count",  names(data)[grepl("X", names(data))]) %>%
  filter(iso2 == "US", Lat != "0", Long_ != "0") %>% #Only include US and with lat long values
  #select(c(UID, FIPS, Admin2, Province_State ,Lat, Long_, date, count)) %>%
  select(UID, Lat, Long_, date, count) %>% # Select required
  rename('lat' = Lat, 'lon' = Long_) %>% # Rename for ease
  mutate(date = str_replace_all(date, "X", "")) %>% # Fix date
  mutate(date = as.Date(date, format = "%m.%d.%y")) %>% # Parse date
  arrange(date) # sort by date

## Group by week
df <- group_by(df, UID, date=cut(date, "1 day")) %>%
  summarise(count = sum(count), lat=first(lat), lon=first(lon))  %>%
  arrange(UID, date)

# add cumsum
df <- mutate(group_by(df,UID), cumsum=cumsum(count))

### Areas with total greater than 2000
filtered <- df %>%
  group_by(UID) %>%
  summarize(cumsum = max(cumsum)) %>%
  filter(cumsum > 1000)

df <- filter(df, UID %in% filtered$UID)

# Add growth factor
df <- df %>%
      arrange(UID, date) %>%
      mutate(gf=count/lag(count))

df$gf[is.na(df$gf)] <- 0 # Remove zero day values, which causes Inf
df <- df[!is.infinite(df$gf),] # Remove first day values, which causes Inf
df$gf <- format(round(df$gf, 3),nsmall=3)

### After March
#df <- filter(df, date > "2020-03-01")

df <- arrange(df, date)
write_csv(df, 'geo_cleaned.csv')

#View(df)
