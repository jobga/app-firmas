<?php
/**
 * Generador de PDF mínimo (una página A4, fuentes estándar, trazos e imágenes JPEG), sin dependencias.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
final class Pdf
{
    public const W = 595.28;
    public const H = 841.89;
    private const FONTS = ['regular' => 'F1', 'bold' => 'F2', 'mono' => 'F3'];

    private string $ops = '';
    /** @var array<int, array{data: string, w: int, h: int}> */
    private array $images = [];

    public function __construct(private string $title = '', private string $author = '') {}

    private static function enc(string $s): string
    {
        $s = mb_convert_encoding($s, 'Windows-1252', 'UTF-8');
        return '(' . strtr($s, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)', "\r" => '', "\n" => ' ']) . ')';
    }

    private static function rgb(string $hex): string
    {
        $h = ltrim($hex, '#');
        return sprintf('%.3F %.3F %.3F', hexdec(substr($h, 0, 2)) / 255, hexdec(substr($h, 2, 2)) / 255, hexdec(substr($h, 4, 2)) / 255);
    }

    /** Ancho aproximado de un texto (Helvetica ≈ 0,5 em; Courier 0,6 em). */
    public static function width(string $s, float $size, string $font = 'regular'): float
    {
        $factor = $font === 'mono' ? 0.6 : ($font === 'bold' ? 0.56 : 0.52);
        return mb_strlen($s) * $size * $factor;
    }

    /** Escribe texto; $y es la línea base medida desde arriba. */
    public function text(float $x, float $y, string $s, float $size = 11, string $font = 'regular', string $color = '#3D3B36'): void
    {
        $this->ops .= sprintf("BT /%s %.2F Tf %s rg %.2F %.2F Td %s Tj ET\n", self::FONTS[$font], $size, self::rgb($color), $x, self::H - $y, self::enc($s));
    }

    /** Escribe un párrafo con ajuste de línea; devuelve la coordenada y de la siguiente línea. */
    public function paragraph(float $x, float $y, float $maxWidth, string $s, float $size = 11, string $font = 'regular', string $color = '#3D3B36', float $leading = 1.4): float
    {
        $line = '';
        foreach (preg_split('/\s+/', trim($s)) as $word) {
            $try = $line === '' ? $word : "$line $word";
            if ($line !== '' && self::width($try, $size, $font) > $maxWidth) {
                $this->text($x, $y, $line, $size, $font, $color);
                $y += $size * $leading;
                $line = $word;
            } else {
                $line = $try;
            }
        }
        if ($line !== '') { $this->text($x, $y, $line, $size, $font, $color); $y += $size * $leading; }
        return $y;
    }

    public function line(float $x1, float $y1, float $x2, float $y2, string $color = '#E4E2DC', float $width = 1, ?array $dash = null): void
    {
        $d = $dash ? '[' . implode(' ', $dash) . '] 0 d ' : '';
        $this->ops .= sprintf("q %s%s RG %.2F w %.2F %.2F m %.2F %.2F l S Q\n", $d, self::rgb($color), $width, $x1, self::H - $y1, $x2, self::H - $y2);
    }

    public function rect(float $x, float $y, float $w, float $h, ?string $fill = null, ?string $stroke = null, ?array $dash = null): void
    {
        $op = $fill && $stroke ? 'B' : ($fill ? 'f' : 'S');
        $this->ops .= 'q ' . ($dash ? '[' . implode(' ', $dash) . '] 0 d ' : '')
            . ($fill ? self::rgb($fill) . ' rg ' : '') . ($stroke ? self::rgb($stroke) . ' RG ' : '')
            . sprintf("%.2F %.2F %.2F %.2F re %s Q\n", $x, self::H - $y - $h, $w, $h, $op);
    }

    /** Dibuja un trazo SVG simple (comandos M, L, C absolutos) escalado en ($x, $y). */
    public function svgPath(string $d, float $x, float $y, float $scale, string $color, float $width): void
    {
        preg_match_all('/[MLC]|-?\d*\.?\d+/', $d, $m);
        $tk = $m[0];
        $out = '';
        $px = fn($v) => sprintf('%.2F', $x + $v * $scale);
        $py = fn($v) => sprintf('%.2F', self::H - ($y + $v * $scale));
        for ($i = 0, $cmd = 'M'; $i < count($tk);) {
            if (in_array($tk[$i], ['M', 'L', 'C'], true)) $cmd = $tk[$i++];
            if ($cmd === 'C') {
                $out .= "{$px($tk[$i])} {$py($tk[$i + 1])} {$px($tk[$i + 2])} {$py($tk[$i + 3])} {$px($tk[$i + 4])} {$py($tk[$i + 5])} c ";
                $i += 6;
            } else {
                $out .= "{$px($tk[$i])} {$py($tk[$i + 1])} " . ($cmd === 'M' ? 'm' : 'l') . ' ';
                $i += 2;
            }
        }
        $this->ops .= sprintf("q %s RG %.2F w 1 J 1 j %sS Q\n", self::rgb($color), $width, $out);
    }

    /** Inserta un JPEG ajustado a la caja indicada, centrado y conservando la proporción. */
    public function jpeg(string $data, float $x, float $y, float $maxW, float $maxH): void
    {
        $info = @getimagesizefromstring($data);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) return;
        [$w, $h] = $info;
        $k = min($maxW / $w, $maxH / $h);
        $dw = $w * $k; $dh = $h * $k;
        $this->images[] = ['data' => $data, 'w' => $w, 'h' => $h];
        $n = count($this->images);
        $this->ops .= sprintf("q %.2F 0 0 %.2F %.2F %.2F cm /Im%d Do Q\n", $dw, $dh, $x + ($maxW - $dw) / 2, self::H - $y - $maxH + ($maxH - $dh) / 2, $n);
    }

    public function output(): string
    {
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        $fontObj = 5;
        $imgObj = $fontObj + 3;
        $xobjects = '';
        foreach ($this->images as $i => $_) $xobjects .= sprintf('/Im%d %d 0 R ', $i + 1, $imgObj + $i);
        $objs[3] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Contents 4 0 R /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R >>%s >> >>',
            self::W, self::H, $fontObj, $fontObj + 1, $fontObj + 2, $xobjects ? " /XObject << $xobjects>>" : '');
        $content = gzcompress($this->ops);
        $objs[4] = "<< /Length " . strlen($content) . " /Filter /FlateDecode >>\nstream\n{$content}\nendstream";
        foreach (['Helvetica', 'Helvetica-Bold', 'Courier'] as $k => $base) {
            $objs[$fontObj + $k] = "<< /Type /Font /Subtype /Type1 /BaseFont /{$base} /Encoding /WinAnsiEncoding >>";
        }
        foreach ($this->images as $i => $img) {
            $objs[$imgObj + $i] = sprintf("<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
                $img['w'], $img['h'], strlen($img['data']), $img['data']);
        }
        $info = count($objs) + 1;
        $objs[$info] = sprintf('<< /Title %s /Author %s /Creator %s /Producer %s /CreationDate (D:%s) >>',
            self::enc($this->title), self::enc($this->author), self::enc('Animalista · Plataforma de firmas'), self::enc('© Jonnathan Bucheli Galindo'), gmdate('YmdHis') . 'Z');

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $n => $body) {
            $offsets[$n] = strlen($pdf);
            $pdf .= "{$n} 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref' . "\n0 " . (count($objs) + 1) . "\n0000000000 65535 f \n";
        foreach ($offsets as $o) $pdf .= sprintf("%010d 00000 n \n", $o);
        $pdf .= "trailer\n<< /Size " . (count($objs) + 1) . " /Root 1 0 R /Info {$info} 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
        return $pdf;
    }
}
