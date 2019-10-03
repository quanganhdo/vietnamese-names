# coding: utf8

import scrapy
import string

class NamesSpider(scrapy.Spider):
    name = "names"
    base_url = 'https://www.huggies.com.vn/dat-ten-cho-be/'
    start_urls = [base_url+s for s in list(string.ascii_uppercase)]
    
    def parse(self, response):
        for name in response.css('.name-detail'):
            sex = 1 
            if name.css('.img-1').extract_first() is not None:
                sex |= (1 << 1)
            if name.css('.img-2').extract_first() is not None:
                sex |= (1 << 2)
            yield {
                'first_name': name.css('strong a::text').extract_first(),
                'sex': sex,
                'meaning': name.css('.text p::text').extract_first()
            }
            
        next_page = response.css('.pagination .next a::attr(href)').extract_first()
        if next_page is not None:
            yield response.follow(next_page, callback=self.parse)