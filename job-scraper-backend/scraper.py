import requests
from bs4 import BeautifulSoup
import urllib.parse


def scrape_linkedin(keyword, location):
    # LinkedIn job search API endpoint
    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={keyword}&location={location}"
    
    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        return []

    soup = BeautifulSoup(response.content, "html.parser")
    jobs = []

    # Find job cards
    job_cards = soup.find_all("div", class_="base-search-card__info")

    for card in job_cards:
        title = card.find("h3", class_="base-search-card__title")
        company = card.find("h4", class_="base-search-card__subtitle")
        link_tag = card.find_previous("a", class_="base-card__full-link")

        if title and company:
            jobs.append({
                "title": title.text.strip(),
                "company": company.text.strip(),
                "location": location,
                "platform": "LinkedIn",
                "link": link_tag["href"] if link_tag else "#"
            })

    return jobs


def scrape_naukri(keyword, location):
    """Scrape jobs from Naukri.com"""
    jobs = []
    
    # Naukri job search URL
    encoded_keyword = urllib.parse.quote(keyword)
    url = f"https://www.naukri.com/jobs/{encoded_keyword}-jobs"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return jobs
            
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Naukri job cards - multiple possible selectors
        job_cards = soup.find_all("div", class_="jobTuple") or soup.find_all("div", class_="job-card")
        
        for card in job_cards:
            title_tag = card.find("a", class_="title") or card.find("h3")
            company_tag = card.find("a", class_="companyInfo") or card.find("p", class_="companyName")
            location_tag = card.find("span", class_="location") or card.find("li", class_="location")
            
            if title_tag:
                link = title_tag.get("href", "")
                if not link.startswith("http"):
                    link = f"https://www.naukri.com{link}"
                jobs.append({
                    "title": title_tag.text.strip(),
                    "company": company_tag.text.strip() if company_tag else "N/A",
                    "location": location_tag.text.strip() if location_tag else location,
                    "platform": "Naukri",
                    "link": link
                })
    except Exception as e:
        print(f"Naukri scraper error: {e}")
    
    return jobs


def scrape_internshala(keyword, location):
    """Scrape jobs from Internshala"""
    jobs = []
    
    # Internshala job listings
    encoded_keyword = urllib.parse.quote(keyword)
    url = f"https://internshala.com/jobs/{encoded_keyword}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return jobs
            
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Internshala job cards
        job_cards = soup.find_all("div", class_="individual_internship")
        
        for card in job_cards:
            title_tag = card.find("h3", class_="heading")
            company_tag = card.find("p", class_="company_name")
            location_tag = card.find("span", class_="location_names")
            
            if title_tag:
                link_tag = card.find("a")
                jobs.append({
                    "title": title_tag.text.strip(),
                    "company": company_tag.text.strip() if company_tag else "N/A",
                    "location": location_tag.text.strip() if location_tag else location,
                    "platform": "Internshala",
                    "link": f"https://internshala.com{link_tag.get('href', '')}" if link_tag else "#"
                })
    except Exception as e:
        print(f"Internshala scraper error: {e}")
    
    return jobs


def scrape_indeed(keyword, location):
    """Scrape jobs from Indeed"""
    jobs = []
    
    encoded_keyword = urllib.parse.quote(keyword)
    encoded_location = urllib.parse.quote(location)
    url = f"https://www.indeed.com/jobs?q={encoded_keyword}&l={encoded_location}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return jobs
            
        soup = BeautifulSoup(response.content, "html.parser")
        
        job_cards = soup.find_all("div", class_="jobsearch-ResultsList")
        
        for card in job_cards:
            title_tag = card.find("h2", class_="jobTitle")
            company_tag = card.find("div", class_="company_location")
            location_tag = card.find("div", class_="company_location")
            
            if title_tag:
                link_tag = title_tag.find("a")
                jobs.append({
                    "title": title_tag.text.strip(),
                    "company": company_tag.text.strip() if company_tag else "N/A",
                    "location": location_tag.text.strip() if location_tag else location,
                    "platform": "Indeed",
                    "link": f"https://www.indeed.com{link_tag.get('href', '')}" if link_tag else "#"
                })
    except Exception as e:
        print(f"Indeed scraper error: {e}")
    
    return jobs


def run_all_scrapers(keyword, location):
    """Run all job scrapers and combine results"""
    all_results = []

    linkedin_jobs = scrape_linkedin(keyword, location)
    all_results.extend(linkedin_jobs)

    naukri_jobs = scrape_naukri(keyword, location)
    all_results.extend(naukri_jobs)

    internshala_jobs = scrape_internshala(keyword, location)
    all_results.extend(internshala_jobs)

    indeed_jobs = scrape_indeed(keyword, location)
    all_results.extend(indeed_jobs)

    return all_results
