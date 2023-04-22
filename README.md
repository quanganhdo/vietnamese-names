Danh sách tên và ý nghĩa tên tiếng Việt lấy từ huggies (cập nhật cuối: 2017)

File `names.jl` (668 entries) chỉ bao gồm tên và file `allnames.jl` (8576 entries) bao gồm cả đệm lẫn tên.

File có định dạng json, gồm 3 properties:

- `first_name`: Tên 
- `meaning`: Ý nghĩa của tên
- `sex`: Giới tính (3 = nam, 5 = nữ, 7 = nam hoặc nữ đều được)

Có thể dùng `jq` để lọc file theo ý muốn. Ví dụ: để tìm tên đặt cho bé trai có chứa chữ "Minh":

```
jq 'select((.first_name | contains("Minh")) and (.sex == 3 or .sex == 7)) | .first_name + ": " + .meaning' allnames.jl | head 
```

Kết quả trả về:

```
"Minh Hạc: Minh là sáng rõ. Minh Hạc là đứa nhỏ xinh tươi, có phúc phận an lành, là đứa con của đất trời nên được yêu quý."
"Minh Hải: \"Minh\" là ngời sáng, thể hiện sự tươi mới sáng sủa, kết hợp với \"Hải\" của biển cả diễn tả hình ảnh thiên nhiên vừa yên bình, vừa giàu sức sống, mặt biển sáng bừng báo hiệu 1 cuộc sống tươi mới"
"Minh Hạ: Tên con mang ý nghĩa 1 loài hoa, vừa xinh đẹp, dịu dàng, vừa thông minh, tài trí."
"Minh Dẫn: Minh Dẫn là hướng đi sáng tỏ, ngụ ý cha mẹ rằng con mình sẽ đủ tài đức dẫn dắt, chỉ huy kẻ khác."
"Minh Danh: tiếng tăm lừng lẫy"
"Minh Giám: Minh Giám theo nghĩa Hán Việt là người có thể nói số này là vận anh hùng, thông minh trời phú, giàu tính nghĩa hiệp."
"Minh Gia: con là điểm sáng, có khối óc và trí tuệ hơn người"
"Minh Giang: Dòng sông với ánh nắng chiếu sáng lấp lánh, gợi hình ảnh tươi vui, sáng sủa, bình an"
"Minh Giảng: Minh Giảng nghĩa là lời giải thích tường tận rõ ràng, hàm ý con sẽ là người có tri thức, hành động tỏ tường minh bạch"
"Minh Giá: \"Minh\" là sáng rõ. \"Minh Giá\" là điểm tựa chắc chắn, chỉ con người có tài cán năng lực."
```
