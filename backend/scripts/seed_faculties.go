package scripts

import (
	"database/sql"
	"fmt"
	"log"
)

type faculty struct {
	code   string
	nameTH string
	nameEN string
}

var cmuFaculties = []faculty{
	{"HUM", "คณะมนุษยศาสตร์", "Faculty of Humanities"},
	{"EDU", "คณะศึกษาศาสตร์", "Faculty of Education"},
	{"FA", "คณะวิจิตรศิลป์", "Faculty of Fine Arts"},
	{"SOC", "คณะสังคมศาสตร์", "Faculty of Social Sciences"},
	{"SCI", "คณะวิทยาศาสตร์", "Faculty of Science"},
	{"ENG", "คณะวิศวกรรมศาสตร์", "Faculty of Engineering"},
	{"AG", "คณะเกษตรศาสตร์", "Faculty of Agriculture"},
	{"MED", "คณะแพทยศาสตร์", "Faculty of Medicine"},
	{"DENT", "คณะทันตแพทยศาสตร์", "Faculty of Dentistry"},
	{"PHAR", "คณะเภสัชศาสตร์", "Faculty of Pharmacy"},
	{"NURS", "คณะพยาบาลศาสตร์", "Faculty of Nursing"},
	{"AMS", "คณะเทคนิคการแพทย์", "Faculty of Associated Medical Sciences"},
	{"VET", "คณะสัตวแพทยศาสตร์", "Faculty of Veterinary Medicine"},
	{"AI", "คณะอุตสาหกรรมเกษตร", "Faculty of Agro-Industry"},
	{"LAW", "คณะนิติศาสตร์", "Faculty of Law"},
	{"ECON", "คณะเศรษฐศาสตร์", "Faculty of Economics"},
	{"BA", "คณะบริหารธุรกิจ", "Faculty of Business Administration"},
	{"MC", "คณะการสื่อสารมวลชน", "Faculty of Mass Communication"},
	{"POLSCI", "คณะรัฐศาสตร์และรัฐประศาสนศาสตร์", "Faculty of Political Science and Public Administration"},
	{"ARCH", "คณะสถาปัตยกรรมศาสตร์", "Faculty of Architecture"},
	{"ICMU", "วิทยาลัยนานาชาติ", "International College"},
	{"CAMT", "วิทยาลัยศิลปะ สื่อ และเทคโนโลยี", "College of Arts, Media and Technology"},
	{"GRAD", "บัณฑิตวิทยาลัย", "Graduate School"},
}

func SeedFaculties(db *sql.DB) error {
	const query = `
		INSERT INTO faculties (code, name_th, name_en)
		VALUES ($1, $2, $3)
		ON CONFLICT (code) DO NOTHING`

	inserted := 0
	for _, f := range cmuFaculties {
		res, err := db.Exec(query, f.code, f.nameTH, f.nameEN)
		if err != nil {
			return fmt.Errorf("insert faculty %s: %w", f.code, err)
		}
		rows, _ := res.RowsAffected()
		inserted += int(rows)
	}
	log.Printf("seed_faculties: %d inserted, %d already existed", inserted, len(cmuFaculties)-inserted)
	return nil
}
